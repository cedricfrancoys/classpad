<?php

use core\setting\Setting;

[$params, $providers] = eQual::announce([
    'type'         => 'get',
    'name'         => 'storage_pad-content',
    'package_name' => 'classpad',
    'description'  => 'Returns the Markdown content of a ClassPad document stored in a course directory.',
    'params'       => [
        'course' => [
            'description' => 'Name of the course containing the document.',
            'type'        => 'string',
            'required'    => true
        ],
        'filename' => [
            'description' => 'Name of the Markdown document to read.',
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
if($storage_path === false || !is_dir($storage_path)) {
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

$course = trim($params['course']);
$filename = trim($params['filename']);
if(!$is_valid_name($course, 120)) {
    throw new Exception('invalid_course_name', EQ_ERROR_INVALID_PARAM);
}
if(!$is_valid_name($filename, 255) || strtolower(pathinfo($filename, PATHINFO_EXTENSION)) !== 'md') {
    throw new Exception('invalid_pad_filename', EQ_ERROR_INVALID_PARAM);
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

$file_path = realpath($course_path . DIRECTORY_SEPARATOR . $filename);
$normalized_course_path = rtrim(str_replace('\\', '/', $course_path), '/');
if(
    $file_path === false
    || !is_file($file_path)
    || strcasecmp(rtrim(str_replace('\\', '/', dirname($file_path)), '/'), $normalized_course_path) !== 0
) {
    throw new Exception('pad_not_found', EQ_ERROR_INVALID_PARAM);
}
if(!is_readable($file_path)) {
    throw new Exception('pad_not_readable', EQ_ERROR_NOT_ALLOWED);
}
if(filesize($file_path) > 5 * 1024 * 1024) {
    throw new Exception('pad_too_large', EQ_ERROR_INVALID_PARAM);
}

$markdown = file_get_contents($file_path);
if($markdown === false) {
    throw new Exception('cannot_read_pad', EQ_ERROR_UNKNOWN);
}

$title = preg_replace('/\.md$/iu', '', $filename);
$title = preg_replace('/^\d{4}-\d{2}-\d{2}\s+-\s+/u', '', $title);

$context->httpResponse()
    ->body([
        'course'   => $course,
        'filename' => $filename,
        'title'    => $title,
        'markdown' => $markdown,
        'modified' => filemtime($file_path)
    ])
    ->send();
