# Dot-source from a PowerShell terminal before local emulators, API or seed.
if ($env:GOOGLE_APPLICATION_CREDENTIALS -or $env:FIREBASE_SERVICE_ACCOUNT_PATH -or $env:FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS -eq 'true') {
    throw 'Use a separate terminal without cloud credential variables for local Emulator development.'
}
$foodOrderLocalRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$env:FIREBASE_MODE = 'emulator'
$env:FIREBASE_PROJECT_ID = 'demo-foodordernext'
$env:GCLOUD_PROJECT = 'demo-foodordernext'
$env:GOOGLE_CLOUD_PROJECT = 'demo-foodordernext'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$env:FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199'
$env:STORAGE_EMULATOR_HOST = 'http://127.0.0.1:9199'
$env:FIREBASE_EMULATORS_PATH = Join-Path $foodOrderLocalRoot '.cache\firebase\emulators'
$env:XDG_CONFIG_HOME = Join-Path $foodOrderLocalRoot '.cache\config'
$env:API_BIND_HOST = '127.0.0.1'
$env:PORT = '5000'

