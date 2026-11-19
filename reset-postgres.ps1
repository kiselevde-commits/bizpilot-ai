Write-Host "=== Перезапуск службы PostgreSQL ==="
Stop-Service -Name "postgresql-x64-16" -Force
Start-Sleep -Seconds 5
Start-Service -Name "postgresql-x64-16"
Start-Sleep -Seconds 5
$svc = Get-Service -Name "postgresql-x64-16"
Write-Host "Статус службы: $($svc.Status)"
Write-Host "Тип запуска: $($svc.StartType)"
Write-Host "=== Проверка прослушивания порта 5432 ==="
netstat -ano | Select-String ":5432"
Write-Host "=== Проверка подключения к bizpilot ==="
$env:PGPASSWORD = Read-Host -Prompt "PGPASSWORD for user bizpilot"
& "F:\Program Files\PostgreSQL\16\bin\psql.exe" -U bizpilot -h 127.0.0.1 -d bizpilot -c "SELECT current_user, current_database();" 2>&1
Write-Host "=== Проверка подключения к bizpilot_shadow ==="
$env:PGPASSWORD = Read-Host -Prompt "PGPASSWORD for user bizpilot"
& "F:\Program Files\PostgreSQL\16\bin\psql.exe" -U bizpilot -h 127.0.0.1 -d bizpilot_shadow -c "SELECT current_user, current_database();" 2>&1
Write-Host "=== Фактические настройки PostgreSQL ==="
$env:PGPASSWORD = Read-Host -Prompt "PGPASSWORD for user postgres"
& "F:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h 127.0.0.1 -c "SHOW listen_addresses; SHOW port; SHOW shared_buffers; SHOW work_mem; SHOW max_connections; SHOW maintenance_work_mem;" 2>&1
Write-Host "=== ГОТОВО ==="
