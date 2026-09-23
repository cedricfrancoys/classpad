<?php

use core\setting\Setting;

[$params, $providers] = eQual::announce([
    'type'         => 'get',
    'name'         => 'storage_filesystem-path',
    'package_name' => 'classpad',
    'description'  => 'Returns the local filesystem path used by ClassPad to store documents.',
    'params'       => [],
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

$context->httpResponse()
    ->body([
        'path' => Setting::get_value('classpad', 'storage', 'filesystem.path', '')
    ])
    ->send();
