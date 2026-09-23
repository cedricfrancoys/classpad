<?php

[$params, $providers] = eQual::announce([
    'type'         => 'get',
    'name'         => 'storage_files',
    'package_name' => 'classpad',
    'description'  => 'Lists the readable files contained in a filesystem path.',
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
            'description' => 'Maximum number of files to return.',
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

$files = [];

try {
    $iterator = new DirectoryIterator($base_path);
    foreach($iterator as $item) {
        if($item->isDot() || !$item->isFile() || !$item->isReadable()) {
            continue;
        }

        $filename = $item->getFilename();
        $extension = strtolower($item->getExtension());

        if(strpos($filename, '.') === 0) {
            continue;
        }

        if(!in_array($extension, ['md', 'txt'])) {
            continue;
        }

        $files[] = [
            'name'      => $filename,
            'path'      => $item->getPathname(),
            'type'      => 'file',
            'size'      => $item->getSize(),
            'extension' => $extension,
            'modified'  => $item->getMTime()
        ];
    }
}
catch(UnexpectedValueException $e) {
    throw new Exception('path_not_readable', EQ_ERROR_NOT_ALLOWED);
}

usort($files, fn($a, $b) => strnatcasecmp($a['name'], $b['name']));

$total = count($files);
$files = array_slice($files, $params['start'], $params['limit']);

$context->httpResponse()
    ->body([
        'base_path' => $base_path,
        'count'     => count($files),
        'total'     => $total,
        'files'     => $files
    ])
    ->send();
