# Start-ERP.ps1 (final safe version)
$projectPath = "C:\Users\Hp\Desktop\PGS-ERP"
$nodeExe = "node"
$port = 3000
$logFile = "C:\Users\Hp\Desktop\PGS-ERP\logs\pgs-erp.log"
$altLog = "C:\Users\Hp\Desktop\PGS-ERP\logs\pgs-erp.log.locked"
$pidFile = "C:\Users\Hp\Desktop\PGS-ERP\pgs-erp.pid"
$dbPath = "C:\Users\Hp\Desktop\PGS-ERP\data\database.db"
$backupFolder = "C:\Users\Hp\Desktop\PGS-ERP\backups"

function SafeLog {
    param($text)
    $tries = 0
    while ($tries -lt 5) {
        try {
            $text | Out-File -FilePath $logFile -Append -Encoding UTF8
            return
        } catch {
            Start-Sleep -Milliseconds 200
            $tries++
        }
    }
    # fallback if main log locked
    $text | Out-File -FilePath $altLog -Append -Encoding UTF8
}

function TS { "[" + (Get-Date).ToString() + "] " }

# Ensure dirs
New-Item -Path "$projectPath\logs" -ItemType Directory -Force | Out-Null
New-Item -Path $backupFolder -ItemType Directory -Force | Out-Null

# If pidfile exists and process running, do not start another
if (Test-Path $pidFile) {
    try {
        $existingPid = (Get-Content $pidFile -ErrorAction Stop).Trim()
        if ($existingPid -match '^\d+$') {
            $p = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
            if ($p) {
                $msg = (TS + "Start aborted: process with PID " + $existingPid + " already running.")
                SafeLog $msg
                Write-Output ("Start aborted: process with PID " + $existingPid + " already running.")
                exit 0
            } else {
                Remove-Item $pidFile -ErrorAction SilentlyContinue
                $msg = (TS + "Removed stale pidfile for PID " + $existingPid)
                SafeLog $msg
            }
        } else {
            Remove-Item $pidFile -ErrorAction SilentlyContinue
        }
    } catch {
        $err = $_.ToString()
        $msg = (TS + "Warning while checking pidfile: " + $err)
        SafeLog $msg
    }
}

# Backup DB (safe)
if (Test-Path $dbPath) {
    try {
        $stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
        $backupFile = Join-Path $backupFolder ("database.db.bak." + $stamp)
        Copy-Item -Path $dbPath -Destination $backupFile -Force
        $msg = (TS + "Backup created: " + $backupFile)
        SafeLog $msg
    } catch {
        $err = $_.ToString()
        $msg = (TS + "DB backup failed: " + $err)
        SafeLog $msg
    }
} else {
    $msg = (TS + "WARNING: DB not found at " + $dbPath)
    SafeLog $msg
}

# Start server via cmd redirection so both stdout & stderr go to same file
Set-Location $projectPath

# Build command that sets PORT for the child cmd process and runs node
# Using: cmd.exe /C "set PORT=3000&& node server.js >> "log" 2>&1"
$cmd = '/C "set PORT=' + $port + '&& ' + $nodeExe + ' server.js >> "' + $logFile + '" 2>&1"'

try {
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList $cmd -WindowStyle Hidden -PassThru
    $msg = (TS + "Started server wrapper (cmd.exe) PID " + $proc.Id)
    SafeLog $msg
    # Save PID of the cmd.exe wrapper (Stop script will use this PID)
    $proc.Id | Out-File -FilePath $pidFile -Force
    Write-Output ("Started server wrapper PID " + $proc.Id + ". ERP should be reachable at http://<your-ip>:" + $port)
} catch {
    $err = $_.ToString()
    $msg = (TS + "Failed to start server: " + $err)
    SafeLog $msg
    Write-Output ("Failed to start server: " + $err)
    exit 1
}
