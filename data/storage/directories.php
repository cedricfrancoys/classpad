<?php

[$params, $providers] = eQual::announce([
    'type'         => 'get',
    'name'         => 'storage_directories',
    'package_name' => 'classpad',
    'description'  => 'Lists the readable directories contained in a filesystem path.',
    'params'       => [
        'path' => [
            'description' => 'Absolute filesystem path to browse.',
            'type'        => 'string',
            'required'    => true
        ],
        'start' => [
            'description' => 'Zero-based offset in the sorted result.',
            'type'        => 'integer',
            'default'     => 0,
            'min'         => 0
        ],
        'limit' => [
            'description' => 'Maximum number of directories to return.',
            'type'        => 'integer',
            'default'     => 250,
            'min'         => 1,
            'max'         => 500
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

$base_path = realpath(trim($params['path'], "\"'"));
if($base_path === false || !is_dir($base_path)) {
    throw new Exception('path_not_found', EQ_ERROR_INVALID_PARAM);
}
if(!is_readable($base_path)) {
    throw new Exception('path_not_readable', EQ_ERROR_NOT_ALLOWED);
}

$directories = [];

try {
    $iterator = new DirectoryIterator($base_path);
    foreach($iterator as $item) {
        if($item->isDot() || !$item->isDir() || !$item->isReadable()) {
            continue;
        }

        $directories[] = [
            'name' => $item->getFilename(),
            'path' => $item->getPathname(),
            'type' => 'directory'
        ];
    }
}
catch(UnexpectedValueException $e) {
    throw new Exception('path_not_readable', EQ_ERROR_NOT_ALLOWED);
}

usort($directories, fn($a, $b) => strnatcasecmp($a['name'], $b['name']));

$parent_path = dirname($base_path);
if($parent_path === $base_path) {
    $parent_path = null;
}

$total = count($directories);
$directories = array_slice($directories, $params['start'], $params['limit']);

$context->httpResponse()
    ->body([
        'base_path'   => $base_path,
        'parent_path' => $parent_path,
        'count'       => count($directories),
        'total'       => $total,
        'directories' => $directories
    ])
    ->send();
