<?php

use core\setting\Setting;

[$params, $providers] = eQual::announce([
    'type'         => 'do',
    'name'         => 'storage_rename-course',
    'package_name' => 'classpad',
    'description'  => 'Renames a course directory in the configured ClassPad storage directory.',
    'params'       => [
        'current_name' => [
            'description' => 'Current name of the course directory.',
            'type'        => 'string',
            'required'    => true
        ],
        'new_name' => [
            'description' => 'New name of the course directory.',
            'type'        => 'string',
            'required'    => true
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

$is_valid_name = static function(string $name): bool {
    return $name !== ''
        && $name !== '.'
        && $name !== '..'
        && strlen($name) <= 120
        && !preg_match('/[<>:"\/\\\\|?*\x00-\x1F\x7F]/u', $name)
        && !preg_match('/[ .]$/u', $name)
        && !preg_match('/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu', $name);
};

$current_name = trim($params['current_name']);
$new_name = trim($params['new_name']);
if(!$is_valid_name($current_name) || !$is_valid_name($new_name)) {
    throw new Exception('invalid_course_name', EQ_ERROR_INVALID_PARAM);
}

$course_path = realpath($storage_path . DIRECTORY_SEPARATOR . $current_name);
$normalized_storage_path = rtrim(str_replace('\\', '/', $storage_path), '/');
if(
    $course_path === false
    || !is_dir($course_path)
    || strcasecmp(rtrim(str_replace('\\', '/', dirname($course_path)), '/'), $normalized_storage_path) !== 0
) {
    throw new Exception('course_not_found', EQ_ERROR_INVALID_PARAM);
}

$new_course_path = $storage_path . DIRECTORY_SEPARATOR . $new_name;
if(file_exists($new_course_path)) {
    throw new Exception('course_already_exists', EQ_ERROR_CONFLICT_OBJECT);
}
if(!rename($course_path, $new_course_path)) {
    throw new Exception('cannot_rename_course_directory', EQ_ERROR_INVALID_CONFIG);
}

$context->httpResponse()
    ->body([
        'previous_name' => $current_name,
        'name'          => $new_name
    ])
    ->send();
