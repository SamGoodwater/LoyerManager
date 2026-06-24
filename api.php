<?php
/**
 * API Loyer Manager — point d'entrée HTTP (routeur).
 */
declare(strict_types=1);

require_once __DIR__ . '/php/bootstrap.php';

$ctx = loyerBootstrap(__DIR__);
loyerDemoMaybeReset($ctx);
$action = isset($_GET['action']) ? (string) $_GET['action'] : '';

switch ($action) {
    case 'config':
        loyerHandleConfig($ctx);
    case 'status':
        loyerHandleStatus($ctx);
    case 'auth-status':
        loyerHandleAuthStatus($ctx);
    case 'auth-setup':
        loyerHandleAuthSetup($ctx);
    case 'auth-login':
        loyerHandleAuthLogin($ctx);
    case 'auth-logout':
        loyerHandleAuthLogout($ctx);
    case 'auth-change-password':
        loyerHandleAuthChangePassword($ctx);
    case 'auth-delete-account':
        loyerHandleAuthDeleteAccount($ctx);
    case 'profile-export':
        loyerHandleProfileExport($ctx);
    case 'profile-import':
        loyerHandleProfileImport($ctx);
    case 'profile-reset-data':
        loyerHandleProfileResetData($ctx);
    case 'auth-prepare-backup':
        loyerHandleAuthPrepareBackup($ctx);
    case 'auth-pending-backup':
        loyerHandleAuthPendingBackup($ctx);
    case 'auth-oauth-start':
        loyerHandleAuthOAuthStart($ctx);
    case 'smtp-settings':
        loyerHandleSmtpSettings($ctx);
    case 'mail-transport-status':
        loyerHandleMailTransportStatus($ctx);
    case 'data':
        loyerHandleData($ctx);
    case 'templates':
        loyerHandleTemplatesList($ctx);
    case 'template':
        loyerHandleTemplate($ctx);
    case 'oauth-status':
        loyerHandleOAuthStatus($ctx);
    case 'oauth-start':
        loyerHandleOAuthStart($ctx);
    case 'oauth-callback':
        loyerHandleOAuthCallback($ctx);
    case 'oauth-disconnect':
        loyerHandleOAuthDisconnect($ctx);
    case 'oauth-set-active':
        loyerHandleOAuthSetActive($ctx);
    case 'send-mail':
        loyerRouteSendMail($ctx);
    case 'save-mail-draft':
        loyerRouteSaveMailDraft($ctx);
    case 'log-export':
        loyerRouteLogExport($ctx);
    case 'log-csv-import':
        loyerRouteLogCsvImport($ctx);
    case 'activity-log':
        loyerRouteActivityLog($ctx);
    case 'app-settings':
        loyerHandleAppSettings($ctx);
    default:
        respondJson(['ok' => false, 'error' => 'Action inconnue'], 400);
}
