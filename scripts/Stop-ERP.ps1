# Stop-ERP.ps1 (safe, will fallback if log locked)
$pidFile = "C:\Users\Hp\Desktop\PGS-ERP\pgs-erp.pid"
$logFile = "C:\Users\Hp\Desktop\PGS-ERP\logs\pgs-erp.log"
$altLog = "C:\Users\Hp\Desktop\PGS-ERP\logs\pgs-erp.log.locked"

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
    $text | Out-File -FilePath $altLog -Append -Encoding UTF8
}

function TS { "[" + (Get-Date).ToString() + "] " }

SafeLog (TS() + "Stop script started.")

if (Test-Path $pidFile) {
    try {
        $pid = (Get-Content $pidFile -ErrorAction Stop).Trim()
        if ($pid -match '^\d+$') {
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc) {
                SafeLog (TS() + "Attempting to stop process PID " + $pid + "...")
                try {
                    Stop-Process -Id $pid -Force -ErrorAction Stop
                    try { Wait-Process -Id $pid -ErrorAction SilentlyContinue -Timeout 5 } catch { }
                    SafeLog (TS() + "Stopped PID " + $pid)
                } catch {
                    $err = $_.ToString()
                    SafeLog (TS() + "Failed to stop PID " + $pid + " via Stop-Process: " + $err)
                    try {
                        Stop-Process -Id $pid -Force
                        SafeLog (TS() + "Kill signal sent to PID " + $pid)
                    } catch {
                        $err2 = $_.ToString()
                        SafeLog (TS() + "Still failed to stop PID " + $pid + ": " + $err2)
                    }
                }
                Remove-Item $pidFile -ErrorAction SilentlyContinue
            } else {
                SafeLog (TS() + "No running process with PID " + $pid + " found. Removing pidfile.")
                Remove-Item $pidFile -ErrorAction SilentlyContinue
            }
        } else {
            SafeLog (TS() + "PID file content invalid: '" + $pid + "'. Removing pidfile.")
            Remove-Item $pidFile -ErrorAction SilentlyContinue
        }
    } catch {
        $err = $_.ToString()
        SafeLog (TS() + "Error reading/stopping PID from pidfile: " + $err)
    }
} else {
    SafeLog (TS() + "PID file not found. Inspecting node processes for project path.")
    $projectPath = "C:\Users\Hp\Desktop\PGS-ERP"
    $nodes = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodes) {
        foreach ($n in $nodes) {
            $pid = $n.Id
            $cmdLine = ""
            try { $q = Get-CimInstance Win32_Process -Filter "ProcessId = $pid"; $cmdLine = $q.CommandLine } catch {}
            if ($cmdLine -and ($cmdLine -like "*$projectPath*")) {
                SafeLog (TS() + "Stopping node PID " + $pid + " (cmdline matched).")
                try { Stop-Process -Id $pid -Force; SafeLog (TS() + "Stopped node PID " + $pid) } catch { $err = $_.ToString(); SafeLog (TS() + "Failed to stop node PID " + $pid + ": " + $err) }
            } else {
                SafeLog (TS() + "Skipping node PID " + $pid + " (cmdline not matched).")
            }
        }
    } else {
        SafeLog (TS() + "No 'node' processes found.")
    }
}

SafeLog (TS() + "Stop script finished.")
