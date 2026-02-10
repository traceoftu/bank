# JBCH Bank 기존 영상 썸네일 일괄 생성
# PowerShell 스크립트

$BUCKET = "r2:jbch-word-bank-videos"
$TEMP_DIR = "$env:TEMP\jbch_thumbs"

Write-Host ""
Write-Host "========================================"
Write-Host "기존 영상 썸네일 일괄 생성"
Write-Host "========================================"
Write-Host ""

# 임시 폴더 생성
if (-not (Test-Path $TEMP_DIR)) {
    New-Item -ItemType Directory -Path $TEMP_DIR | Out-Null
}

# R2에서 영상 목록 가져오기
Write-Host "[1/3] R2에서 영상 목록 가져오는 중..."
$videos = rclone lsf $BUCKET --recursive --include "*.mp4" | Where-Object { $_ -match "\.mp4$" }

$count = $videos.Count
Write-Host "발견된 영상: $count 개"
Write-Host ""

Write-Host "[2/3] 썸네일 생성 및 업로드 중..."
Write-Host ""

$current = 0
$success = 0
$skipped = 0

foreach ($video in $videos) {
    $current++
    $thumbPath = "thumbnails/$video.jpg"
    
    # 이미 썸네일이 있는지 확인
    $exists = rclone lsf "$BUCKET/$thumbPath" 2>$null
    if ($exists) {
        Write-Host "[$current/$count] [건너뜀] $video - 썸네일 존재"
        $skipped++
        continue
    }
    
    Write-Host "[$current/$count] [생성중] $video"
    
    # 영상 다운로드
    rclone copy "$BUCKET/$video" $TEMP_DIR -q
    
    # 파일명 추출
    $filename = Split-Path $video -Leaf
    $localVideo = Join-Path $TEMP_DIR $filename
    $localThumb = Join-Path $TEMP_DIR "thumb.jpg"
    
    # 썸네일 생성
    ffmpeg -y -i $localVideo -ss 00:00:01 -vframes 1 -vf "scale=480:-1" -q:v 3 $localThumb -loglevel error 2>$null
    
    if (Test-Path $localThumb) {
        # 썸네일 업로드
        rclone copyto $localThumb "$BUCKET/$thumbPath" -q
        Write-Host "     [완료]"
        $success++
        Remove-Item $localThumb -Force
    } else {
        Write-Host "     [실패] 썸네일 생성 실패"
    }
    
    # 다운로드한 영상 삭제
    Remove-Item $localVideo -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "[3/3] 정리 중..."
Remove-Item $TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================"
Write-Host "완료!"
Write-Host "========================================"
Write-Host "생성됨: $success 개"
Write-Host "건너뜀: $skipped 개 (이미 존재)"
Write-Host ""
