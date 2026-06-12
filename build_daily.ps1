$ErrorActionPreference = "Stop"

# Yagona hisoblash manbai: eski PowerShell formulasi yangi SKU/customer/TIN
# modelini bosib yubormasligi uchun aktiv generatorlarga yo'naltiramiz.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
& python (Join-Path $root "build_sales_demand.py")
if ($LASTEXITCODE -ne 0) { throw "build_sales_demand.py xatolik bilan tugadi" }
& python (Join-Path $root "rebuild_sales_dashboard.py")
if ($LASTEXITCODE -ne 0) { throw "rebuild_sales_dashboard.py xatolik bilan tugadi" }
Write-Host "TAYYOR: data_daily.json, sales.html va sales_runtime.js yangilandi"
exit 0

# Quyidagi kod tarixiy formula sifatida saqlangan, lekin yuqoridagi exit sabab
# bajarilmaydi.
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false; $excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open("C:\Tiim Market Base Loyihasi\sotuv_excel.xlsx", $false, $true)
$sh = $wb.Sheets.Item(1)
$last = $sh.UsedRange.Rows.Count
Write-Host "Jami satr: $last"
$dateArr = $sh.Range("A2:A$last").Value2
$rcptArr = $sh.Range("D2:D$last").Value2
$itemArr = $sh.Range("F2:F$last").Value2
$qtyArr  = $sh.Range("G2:G$last").Value2
$wb.Close($false); $excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
[GC]::Collect()
Write-Host "O'qildi. Sanalar tahlil qilinmoqda..."

$n = $dateArr.GetLength(0)
function ParseDate($d){
  if($null -eq $d){ return $null }
  if($d -is [double]){ return [datetime]::FromOADate($d) }
  try { return [datetime]::Parse($d.ToString()) } catch { return $null }
}
# Min/max sana
$minD=[datetime]::MaxValue; $maxD=[datetime]::MinValue
for($i=1;$i -le $n;$i++){ $dt=ParseDate $dateArr.GetValue($i,1); if($dt){ if($dt -lt $minD){$minD=$dt}; if($dt -gt $maxD){$maxD=$dt} } }
$days = ($maxD - $minD).Days + 1
Write-Host ("Davr: " + $minD.ToString('yyyy-MM-dd') + " dan " + $maxD.ToString('yyyy-MM-dd') + " gacha = $days kun")

# Labels va title
$labels = @(); for($k=0;$k -lt $days;$k++){ $labels += $minD.AddDays($k).ToString('MM-dd') }
$ci = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')
$title = $minD.ToString('MMMM yyyy', $ci)
$endStr = $maxD.ToString('yyyy-MM-dd')

Write-Host "Cheklar yig'ilmoqda..."
# Per (item|receipt): qty va day
$rq = @{}; $rdy = @{}; $itemKeys = @{}
$base = $minD.Date
$proc=0
for($i=1;$i -le $n;$i++){
  $itm = $itemArr.GetValue($i,1); if($null -eq $itm){continue}
  $name = ($itm.ToString() -replace '\s+',' ').Trim().ToLower()
  if($name -eq ""){continue}
  $dt = ParseDate $dateArr.GetValue($i,1); if($null -eq $dt){continue}
  $di = ($dt.Date - $base).Days; if($di -lt 0 -or $di -ge $days){continue}
  $rc = $rcptArr.GetValue($i,1); $rcS = if($null -eq $rc){""}else{$rc.ToString()}
  $q = $qtyArr.GetValue($i,1); if($null -eq $q){$q=0}
  $key = $name + "|" + $rcS
  if($rq.ContainsKey($key)){ $rq[$key] += [double]$q } else {
    $rq[$key] = [double]$q; $rdy[$key] = $di
    if(-not $itemKeys.ContainsKey($name)){ $itemKeys[$name] = New-Object System.Collections.Generic.List[string] }
    $itemKeys[$name].Add($key)
  }
  $proc++; if($proc % 50000 -eq 0){ Write-Host "  ...$proc" }
}
Write-Host ("Mahsulotlar: " + $itemKeys.Count + ". Ulgurji aniqlanmoqda + JSON...")

function Pctl($sorted,$p){ if($sorted.Count -eq 0){return 0}; $idx=[math]::Floor($p*($sorted.Count-1)); $sorted[$idx] }

$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('{"__meta__":{"days":'+$days+',"start":"'+$minD.ToString('yyyy-MM-dd')+'","end":"'+$endStr+'","title":"'+$title+'","labels":['+(($labels|ForEach-Object{'"'+$_+'"'}) -join ',')+']},"items":{')
$first=$true
foreach($name in $itemKeys.Keys){
  $keys = $itemKeys[$name]
  # receipt qtys
  $qtys = New-Object System.Collections.Generic.List[double]
  foreach($k in $keys){ $qtys.Add($rq[$k]) }
  $sorted = @($qtys | Where-Object {$_ -gt 0} | Sort-Object)
  $p75 = Pctl $sorted 0.75
  $p90 = Pctl $sorted 0.90
  # Dinamik chegara: past hajmli mahsulotlar uchun yuqoriroq koeffitsient
  $mult = if($p90 -le 3){5} elseif($p90 -le 7){4} else{3}
  $tdyn = [math]::Max($p90*$mult, 10)
  # arrays
  $qa = New-Object 'double[]' $days
  $ra = New-Object 'int[]' $days
  $wa = New-Object 'double[]' $days
  foreach($k in $keys){
    $qv = $rq[$k]; $d = $rdy[$k]
    $qa[$d] += $qv; $ra[$d] += 1
    if($qv -ge $tdyn -or $qv -ge 40){ $wa[$d] += $qv }
  }
  # Retail hisoblash (ulgurji chiqarilgandan keyin)
  $retMonth = 0.0; $retDays = 0
  for($k=0;$k -lt $days;$k++){
    $ret = $qa[$k] - $wa[$k]; if($ret -gt 0.001){$retMonth += $ret; $retDays++}
  }
  $retAvg   = if($days    -gt 0){[math]::Round($retMonth/$days,    2)}else{0}
  $retActAvg= if($retDays -gt 0){[math]::Round($retMonth/$retDays, 2)}else{0}
  $retMonthR= if([math]::Abs($retMonth-[math]::Round($retMonth)) -lt 0.01){[int][math]::Round($retMonth)}else{[math]::Round($retMonth,1)}
  $qStr=New-Object System.Text.StringBuilder; $rStr=New-Object System.Text.StringBuilder; $wStr=New-Object System.Text.StringBuilder
  for($k=0;$k -lt $days;$k++){
    if($k -gt 0){[void]$qStr.Append(',');[void]$rStr.Append(',');[void]$wStr.Append(',')}
    $qv=$qa[$k]; if([math]::Abs($qv-[math]::Round($qv)) -lt 0.001){[void]$qStr.Append([int][math]::Round($qv))}else{[void]$qStr.Append([math]::Round($qv,2))}
    [void]$rStr.Append($ra[$k])
    $wv=$wa[$k]; if([math]::Abs($wv-[math]::Round($wv)) -lt 0.001){[void]$wStr.Append([int][math]::Round($wv))}else{[void]$wStr.Append([math]::Round($wv,2))}
  }
  $nameEsc = $name.Replace('\','\\').Replace('"','\"')
  if(-not $first){[void]$sb.Append(',')}; $first=$false
  [void]$sb.Append('"'+$nameEsc+'":{"q":['+$qStr.ToString()+'],"r":['+$rStr.ToString()+'],"w":['+$wStr.ToString()+'],"rm":'+$retMonthR+',"ra":'+$retAvg+',"rd":'+$retDays+',"raa":'+$retActAvg+'}')
}
[void]$sb.Append('}}')
[System.IO.File]::WriteAllText("C:\Tiim Market Base Loyihasi\data_daily.json", $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "TAYYOR: data_daily.json"
