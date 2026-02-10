@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM ============================================
REM JBCH Bank 영상 업로드 스크립트
REM 사용법: upload-video.bat "영상파일경로" "R2폴더경로"
REM 예시: upload-video.bat "C:\Videos\새영상.mp4" "성인/2024"
REM ============================================

if "%~1"=="" (
    echo 사용법: upload-video.bat "영상파일경로" "R2폴더경로"
    echo 예시: upload-video.bat "C:\Videos\새영상.mp4" "성인/2024"
    exit /b 1
)

if "%~2"=="" (
    echo 사용법: upload-video.bat "영상파일경로" "R2폴더경로"
    echo 예시: upload-video.bat "C:\Videos\새영상.mp4" "성인/2024"
    exit /b 1
)

set "VIDEO=%~1"
set "REMOTE_PATH=%~2"
set "FILENAME=%~nx1"
set "THUMB_FILE=%TEMP%\%FILENAME%.thumb.jpg"

echo.
echo ========================================
echo 영상 업로드 시작
echo ========================================
echo 영상 파일: %VIDEO%
echo 업로드 경로: %REMOTE_PATH%
echo.

REM 영상 파일 존재 확인
if not exist "%VIDEO%" (
    echo [오류] 영상 파일을 찾을 수 없습니다: %VIDEO%
    exit /b 1
)

REM 1. 썸네일 생성
echo [1/3] 썸네일 생성 중...
ffmpeg -y -i "%VIDEO%" -ss 00:00:01 -vframes 1 -vf "scale=480:-1" -q:v 3 "%THUMB_FILE%" -loglevel error

if errorlevel 1 (
    echo [오류] 썸네일 생성 실패
    exit /b 1
)
echo      썸네일 생성 완료: %THUMB_FILE%

REM 2. 영상 업로드
echo [2/3] 영상 업로드 중...
rclone copy "%VIDEO%" "r2:jbchbank/%REMOTE_PATH%/" --progress

if errorlevel 1 (
    echo [오류] 영상 업로드 실패
    exit /b 1
)
echo      영상 업로드 완료

REM 3. 썸네일 업로드 (thumbnails 폴더에 저장)
echo [3/3] 썸네일 업로드 중...
rclone copyto "%THUMB_FILE%" "r2:jbchbank/thumbnails/%REMOTE_PATH%/%FILENAME%.jpg" --progress

if errorlevel 1 (
    echo [오류] 썸네일 업로드 실패
    exit /b 1
)
echo      썸네일 업로드 완료

REM 임시 파일 삭제
del "%THUMB_FILE%" 2>nul

echo.
echo ========================================
echo 업로드 완료!
echo ========================================
echo 영상: https://videos.haebomsoft.com/%REMOTE_PATH%/%FILENAME%
echo 썸네일: https://videos.haebomsoft.com/thumbnails/%REMOTE_PATH%/%FILENAME%.jpg
echo.

endlocal
