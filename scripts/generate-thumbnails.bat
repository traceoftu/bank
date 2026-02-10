@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM ============================================
REM JBCH Bank 기존 영상 썸네일 일괄 생성
REM R2에 있는 모든 영상의 썸네일을 생성하여 업로드
REM 사용법: generate-thumbnails.bat
REM ============================================

set "TEMP_DIR=%TEMP%\jbch_thumbs"
set "COUNT=0"
set "SUCCESS=0"
set "SKIPPED=0"

echo.
echo ========================================
echo 기존 영상 썸네일 일괄 생성
echo ========================================
echo.

REM 임시 폴더 생성
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

REM R2에서 영상 목록 가져오기
echo [1/3] R2에서 영상 목록 가져오는 중...
rclone lsf r2:jbchbank --recursive --include "*.mp4" --include "*.mov" --include "*.avi" --include "*.mkv" --include "*.webm" > "%TEMP_DIR%\videos.txt"

REM 영상 개수 확인
for /f %%a in ('type "%TEMP_DIR%\videos.txt" ^| find /c /v ""') do set COUNT=%%a
echo 발견된 영상: %COUNT%개
echo.

echo [2/3] 썸네일 생성 및 업로드 중...
echo.

set "CURRENT=0"
for /f "usebackq delims=" %%f in ("%TEMP_DIR%\videos.txt") do (
    set /a CURRENT+=1
    set "VIDEO_PATH=%%f"
    set "THUMB_PATH=thumbnails/%%f.jpg"
    
    REM 이미 썸네일이 있는지 확인
    rclone lsf "r2:jbchbank/!THUMB_PATH!" >nul 2>&1
    if !errorlevel! equ 0 (
        echo [!CURRENT!/%COUNT%] [건너뜀] %%f - 썸네일 존재
        set /a SKIPPED+=1
    ) else (
        echo [!CURRENT!/%COUNT%] [생성중] %%f
        
        REM 영상 다운로드 (임시)
        set "LOCAL_VIDEO=%TEMP_DIR%\temp_video"
        set "LOCAL_THUMB=%TEMP_DIR%\temp_thumb.jpg"
        
        rclone copy "r2:jbchbank/%%f" "%TEMP_DIR%" -q
        
        REM 파일명 추출
        for %%n in ("%%f") do set "FILENAME=%%~nxn"
        
        REM 썸네일 생성
        ffmpeg -y -i "%TEMP_DIR%\!FILENAME!" -ss 00:00:01 -vframes 1 -vf "scale=480:-1" -q:v 3 "!LOCAL_THUMB!" -loglevel error
        
        if exist "!LOCAL_THUMB!" (
            REM 썸네일 업로드
            rclone copyto "!LOCAL_THUMB!" "r2:jbchbank/!THUMB_PATH!" -q
            echo      [완료]
            set /a SUCCESS+=1
            
            REM 임시 파일 삭제
            del "!LOCAL_THUMB!" 2>nul
        ) else (
            echo      [실패] 썸네일 생성 실패
        )
        
        REM 다운로드한 영상 삭제
        del "%TEMP_DIR%\!FILENAME!" 2>nul
    )
)

echo.
echo [3/3] 정리 중...
del "%TEMP_DIR%\videos.txt" 2>nul
rmdir "%TEMP_DIR%" 2>nul

echo.
echo ========================================
echo 완료!
echo ========================================
echo 생성됨: %SUCCESS%개
echo 건너뜀: %SKIPPED%개 (이미 존재)
echo.

endlocal
