$confPath = "F:\Program Files\PostgreSQL\16\data\postgresql.conf"
$content = Get-Content $confPath -Raw

# listen_addresses = '127.0.0.1'
$content = $content -replace "^listen_addresses\s*=\s*'\*'", "listen_addresses = '127.0.0.1'"
# shared_buffers = 256MB
$content = $content -replace "^shared_buffers\s*=\s*128MB", "shared_buffers = 256MB"
# max_connections = 20
$content = $content -replace "^max_connections\s*=\s*100", "max_connections = 20"
# maintenance_work_mem = 64MB (uncomment and set)
$content = $content -replace "^#maintenance_work_mem\s*=\s*64MB", "maintenance_work_mem = 64MB"
# work_mem = 4MB (uncomment)
$content = $content -replace "^#work_mem\s*=\s*4MB", "work_mem = 4MB"

Set-Content $confPath $content
Write-Host "CONFIG_UPDATED_OK"
