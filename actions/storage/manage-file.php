<?php

use core\setting\Setting;

[$params, $providers] = eQual::announce([
    'type'         => 'do',
    'name'         => 'storage_manage-file',
    'package_name' => 'classpad',
    'description'  => 'Renames, deletes, or moves a file stored in a ClassPad course directory.',
    'params'       => [
        'operation' => [
            'description' => 'Operation to perform on the file.',
            'type'        => 'string',
            'selection'   => ['rename', 'delete', 'move'],
            'required'    => true
        ],
        'course' => [
            'description' => 'Name of the course containing the file.',
            'type'        => 'string',
            'required'    => true
        ],
        'filename' => [
            'description' => 'Current filename.',
            'type'        => 'string',
            'required'    => true
        ],
        'new_name' => [
            'description' => 'New filename when renaming the file.',
            'type'        => 'string',
            'default'     => ''
        ],
        'target_course' => [
            'description' => 'Destination course when moving the file.',
            'type'        => 'string',
            'default'     => ''
        ]
    ],
    'access'       => [
        'visibility' => 'public'
    ],
    'response'     => [
        'content-type'  => 'application/json',
        'charset'       => 'UTF-8',
        'accept-origin' => '*'
    ],
    'providers'    => ['context']
]);

/** @var \equal\php\Context $context */
['context' => $context] = $providers;

$storage_path = realpath(trim(Setting::get_value('classpad', 'storage', 'filesystem.path', ''), "\"'"));
if($storage_path === false || !is_dir($storage_path) || !is_writable($storage_path)) {
    throw new Exception('invalid_storage_path', EQ_ERROR_INVALID_CONFIG);
}

$is_valid_name = static function(string $name, int $max_length): bool {
    return $name !== ''
        && $name !== '.'
        && $name !== '..'
        && strlen($name) <= $max_length
        && !preg_match('/[<>:"\/\\\\|?*\x00-\x1F\x7F]/u', $name)
        && !preg_match('/[ .]$/u', $name)
        && !preg_match('/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu', $name);
};

$resolve_course_path = static function(string $course) use ($storage_path, $is_valid_name): string {
    if(!$is_valid_name($course, 120)) {
        throw new Exception('invalid_course_name', EQ_ERROR_INVALID_PARAM);
    }

    $course_path = realpath($storage_path . DIRECTORY_SEPARATOR . $course);
    $normalized_storage_path = rtrim(str_replace('\\', '/', $storage_path), '/');
    if(
        $course_path === false
        || !is_dir($course_path)
        || strcasecmp(rtrim(str_replace('\\', '/', dirname($course_path)), '/'), $normalized_storage_path) !== 0
    ) {
        throw new Exception('course_not_found', EQ_ERROR_INVALID_PARAM);
    }

    return $course_path;
};

$operation = $params['operation'];
if(!in_array($operation, ['rename', 'delete', 'move'], true)) {
    throw new Exception('invalid_file_operation', EQ_ERROR_INVALID_PARAM);
}

$filename = trim($params['filename']);
if(!$is_valid_name($filename, 255)) {
    throw new Exception('invalid_filename', EQ_ERROR_INVALID_PARAM);
}

$course_path = $resolve_course_path(trim($params['course']));
if(!is_writable($course_path)) {
    throw new Exception('course_directory_not_writable', EQ_ERROR_NOT_ALLOWED);
}

$source_path = realpath($course_path . DIRECTORY_SEPARATOR . $filename);
$normalized_course_path = rtrim(str_replace('\\', '/', $course_path), '/');
if(
    $source_path === false
    || !is_file($source_path)
    || strcasecmp(rtrim(str_replace('\\', '/', dirname($source_path)), '/'), $normalized_course_path) !== 0
) {
    throw new Exception('file_not_found', EQ_ERROR_INVALID_PARAM);
}

$result = [
    'operation' => $operation,
    'course'    => $params['course'],
    'filename'  => $filename
];

if($operation === 'delete') {
    if(!unlink($source_path)) {
        throw new Exception('cannot_delete_file', EQ_ERROR_INVALID_CONFIG);
    }
}
elseif($operation === 'rename') {
    $new_name = trim($params['new_name']);
    if(!$is_valid_name($new_name, 255)) {
        throw new Exception('invalid_filename', EQ_ERROR_INVALID_PARAM);
    }

    $target_path = $course_path . DIRECTORY_SEPARATOR . $new_name;
    if(file_exists($target_path)) {
        throw new Exception('file_already_exists', EQ_ERROR_CONFLICT_OBJECT);
    }
    if(!rename($source_path, $target_path)) {
        throw new Exception('cannot_rename_file', EQ_ERROR_INVALID_CONFIG);
    }
    $result['filename'] = $new_name;
}
else {
    $target_course = trim($params['target_course']);
    $target_course_path = $resolve_course_path($target_course);
    if(strcasecmp($target_course_path, $course_path) === 0) {
        throw new Exception('same_target_course', EQ_ERROR_INVALID_PARAM);
    }
    if(!is_writable($target_course_path)) {
        throw new Exception('target_course_not_writable', EQ_ERROR_NOT_ALLOWED);
    }

    $target_path = $target_course_path . DIRECTORY_SEPARATOR . $filename;
    if(file_exists($target_path)) {
        throw new Exception('file_already_exists', EQ_ERROR_CONFLICT_OBJECT);
    }
    if(!rename($source_path, $target_path)) {
        throw new Exception('cannot_move_file', EQ_ERROR_INVALID_CONFIG);
    }
    $result['course'] = $target_course;
}

$context->httpResponse()
    ->body($result)
    ->send();
