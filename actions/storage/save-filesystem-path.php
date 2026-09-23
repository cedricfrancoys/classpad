<?php

use core\setting\Setting;

[$params, $providers] = eQual::announce([
    'type'         => 'do',
    'name'         => 'storage_filesystem-path',
    'package_name' => 'classpad',
    'description'  => 'Sets the local filesystem path used by ClassPad to store documents.',
    'params'       => [
        'path' => [
            'description' => 'Local filesystem path in which ClassPad documents must be stored.',
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

Setting::assert_value('classpad', 'storage', 'filesystem.path', '');
Setting::set_value('classpad', 'storage', 'filesystem.path', $params['path']);

$context->httpResponse()
    ->status(204)
    ->send();
