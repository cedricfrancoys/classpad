<?php

use core\setting\Setting;

[$params, $providers] = eQual::announce([
    'type'         => 'do',
    'name'         => 'storage_create-course',
    'package_name' => 'classpad',
    'description'  => 'Creates a course directory in the configured ClassPad storage directory.',
    'params'       => [
        'name' => [
            'description' => 'Name of the course directory to create.',
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

$name = trim($params['name']);
if(
    $name === ''
    || $name === '.'
    || $name === '..'
    || strlen($name) > 120
    || preg_match('/[<>:"\/\\\\|?*\x00-\x1F\x7F]/u', $name)
    || preg_match('/[ .]$/u', $name)
    || preg_match('/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu', $name)
) {
    throw new Exception('invalid_course_name', EQ_ERROR_INVALID_PARAM);
}

$course_path = $storage_path . DIRECTORY_SEPARATOR . $name;
if(file_exists($course_path)) {
    throw new Exception('course_already_exists', EQ_ERROR_CONFLICT_OBJECT);
}
if(!mkdir($course_path, 0775)) {
    throw new Exception('cannot_create_course_directory', EQ_ERROR_INVALID_CONFIG);
}

$context->httpResponse()
    ->status(201)
    ->body(['name' => $name])
    ->send();
