<?php

use equal\db\DBConnector;

[$params, $providers] = eQual::announce([
    'type'         => 'do',
    'name'         => 'system_reset',
    'package_name' => 'classpad',
    'description'  => 'Resets the local database and initializes the core package.',
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

$database_path = EQ_BASEDIR . '/bin/equal.db';

DBConnector::getInstance()->disconnect();
clearstatcache(true, $database_path);

if(file_exists($database_path) && !unlink($database_path)) {
    throw new Exception('cannot_delete_database', EQ_ERROR_INVALID_CONFIG);
}

eQual::run('do', 'init_db');
eQual::run('do', 'init_package', [
    'package' => 'core',
    'force'   => true
]);

$context->httpResponse()
    ->status(204)
    ->send();
