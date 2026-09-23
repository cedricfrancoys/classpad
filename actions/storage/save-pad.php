<?php

use core\setting\Setting;

[$params, $providers] = eQual::announce([
    'type'         => 'do',
    'name'         => 'storage_save-pad',
    'package_name' => 'classpad',
    'description'  => 'Saves a ClassPad document as a Markdown file on the configured filesystem.',
    'params'       => [
        'course' => [
            'description' => 'Course associated with the document.',
            'type'        => 'string',
            'required'    => true
        ],
        'subject' => [
            'description' => 'Subject used in the document filename.',
            'type'        => 'string',
            'required'    => true
        ],
        'date_time' => [
            'description' => 'Date and time at which the document is saved, in ISO 8601 format.',
            'type'        => 'string',
            'required'    => true
        ],
        'markdown' => [
            'description' => 'Markdown content to save.',
            'type'        => 'text',
            'required'    => true
        ],
        'filename' => [
            'description' => 'Existing Markdown filename to update instead of deriving one from the subject.',
            'type'        => 'string',
            'default'     => ''
        ],
        'create_only' => [
            'description' => 'Refuses to overwrite an existing document when true.',
            'type'        => 'boolean',
            'default'     => false
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

$storage_path = trim(Setting::get_value('classpad', 'storage', 'filesystem.path', ''));
if($storage_path === '' || !is_dir($storage_path)) {
    throw new Exception('invalid_storage_path', EQ_ERROR_INVALID_CONFIG);
}


if(!is_writable($storage_path)) {

    $test_file = $storage_path . DIRECTORY_SEPARATOR . '.classpad-write-test';

    $result = @file_put_contents($test_file, 'test');

    if($result !== false) {
        @unlink($test_file);
    }

    $error = error_get_last();

    throw new Exception(
        sprintf(
            'non_writeable_storage_path [%s]: %s',
            $storage_path,
            $error['message'] ?? 'write test failed without PHP error'
        ),
        EQ_ERROR_INVALID_CONFIG
    );
}

$course = trim($params['course']);
$safe_course = preg_replace('/[<>:"\/\\\\|?*\x00-\x1F\x7F]+/u', '-', $course);
$safe_course = preg_replace('/\s+/u', ' ', $safe_course);
$safe_course = mb_strcut($safe_course, 0, 120, 'UTF-8');
$safe_course = trim($safe_course, " .-");
if($safe_course === '') {
    throw new Exception('invalid_course', EQ_ERROR_INVALID_PARAM);
}

$subject = trim($params['subject']);
$safe_subject = preg_replace('/[<>:"\/\\\\|?*\x00-\x1F\x7F]+/u', '-', $subject);
$safe_subject = preg_replace('/\s+/u', ' ', $safe_subject);
$safe_subject = mb_strcut($safe_subject, 0, 180, 'UTF-8');
$safe_subject = trim($safe_subject, " .-");
if($safe_subject === '') {
    throw new Exception('invalid_subject', EQ_ERROR_INVALID_PARAM);
}

try {
    $saved_at = new DateTimeImmutable($params['date_time']);
}
catch(Throwable $e) {
    throw new Exception('invalid_date_time', EQ_ERROR_INVALID_PARAM);
}

$separator = preg_match('/[\\\\\/]$/', $storage_path) ? '' : DIRECTORY_SEPARATOR;
$course_path = $storage_path . $separator . $safe_course;
if(!is_dir($course_path) && !mkdir($course_path, 0775, true) && !is_dir($course_path)) {
    throw new Exception('cannot_create_course_directory', EQ_ERROR_INVALID_CONFIG);
}
if(!is_writable($course_path)) {
    throw new Exception('course_directory_not_writable', EQ_ERROR_INVALID_CONFIG);
}

$filename = trim($params['filename']);
if($filename !== '') {
    $is_valid_filename = $filename !== '.'
        && $filename !== '..'
        && strlen($filename) <= 255
        && !preg_match('/[<>:"\/\\\\|?*\x00-\x1F\x7F]/u', $filename)
        && !preg_match('/[ .]$/u', $filename)
        && strtolower(pathinfo($filename, PATHINFO_EXTENSION)) === 'md';
    if(!$is_valid_filename) {
        throw new Exception('invalid_pad_filename', EQ_ERROR_INVALID_PARAM);
    }

    $existing_path = realpath($course_path . DIRECTORY_SEPARATOR . $filename);
    $normalized_course_path = rtrim(str_replace('\\', '/', $course_path), '/');
    if(
        $existing_path === false
        || !is_file($existing_path)
        || strcasecmp(rtrim(str_replace('\\', '/', dirname($existing_path)), '/'), $normalized_course_path) !== 0
    ) {
        throw new Exception('pad_not_found', EQ_ERROR_INVALID_PARAM);
    }
}
else {
    $filename = $saved_at->format('Y-m-d') . ' - ' . $safe_subject . '.md';
}
$target_path = $course_path . DIRECTORY_SEPARATOR . $filename;

if($params['create_only'] && file_exists($target_path)) {
    throw new Exception('pad_already_exists', EQ_ERROR_CONFLICT_OBJECT);
}

if(file_put_contents($target_path, $params['markdown'], LOCK_EX) === false) {
    throw new Exception('cannot_save_pad', EQ_ERROR_INVALID_CONFIG);
}

$context->httpResponse()
    ->body([
        'course'    => $course,
        'directory' => $safe_course,
        'subject'   => $subject,
        'saved_at'  => $saved_at->format(DateTimeInterface::ATOM),
        'filename'  => $filename
    ])
    ->send();
