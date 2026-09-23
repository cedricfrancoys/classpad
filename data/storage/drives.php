<?php

[$params, $providers] = eQual::announce([
    'type'         => 'get',
    'name'         => 'storage_drives',
    'package_name' => 'classpad',
    'description'  => 'Returns the filesystem roots available to the ClassPad server.',
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

$roots = [];

if(PHP_OS_FAMILY === 'Windows') {
    foreach(range('A', 'Z') as $letter) {
        $path = $letter . ':\\';
        if(!is_dir($path)) {
            continue;
        }

        $roots[] = [
            'name'  => $letter . ':',
            'path'  => $path,
            'type'  => 'drive',
            'total' => @disk_total_space($path) ?: null,
            'free'  => @disk_free_space($path) ?: null
        ];
    }
}
else {
    $paths = ['/'];

    if(is_file('/proc/mounts') && is_readable('/proc/mounts')) {
        foreach(file('/proc/mounts', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $parts = preg_split('/\s+/', $line);
            if(isset($parts[1])) {
                $paths[] = str_replace('\\040', ' ', $parts[1]);
            }
        }
    }

    foreach(array_merge(glob('/mnt/*') ?: [], glob('/media/*') ?: [], glob('/Volumes/*') ?: []) as $path) {
        $paths[] = $path;
    }

    foreach(array_values(array_unique($paths)) as $path) {
        if(!is_dir($path) || !is_readable($path)) {
            continue;
        }
        if($path !== '/' && preg_match('#^/(proc|sys|dev|run)(/|$)#', $path)) {
            continue;
        }

        $roots[] = [
            'name'  => $path === '/' ? '/' : (basename($path) ?: $path),
            'path'  => $path,
            'type'  => $path === '/' ? 'system' : 'mount',
            'total' => @disk_total_space($path) ?: null,
            'free'  => @disk_free_space($path) ?: null
        ];
    }
}

$context->httpResponse()
    ->body([
        'count'  => count($roots),
        'drives' => $roots
    ])
    ->send();
