@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM ============================================
REM JBCH Bank 폴더 업로드 스크립트
REM 폴더 내 모든 영상을 썸네일과 함께 업로드
REM 사용법: upload-folder.bat "로컬폴더경로" "R2폴더경로"
REM 예시: upload-folder.bat "C:\Videos\2024" "성인/2024"
REM ============================================

if "%~1"=="" (
    echo 사용법: upload-folder.bat "로컬폴더경로" "R2폴더경로"
    echo 예시: upload-folder.bat "C:\Videos\2024" "성인/2024"
    exit /b 1
)

if "%~2"=="" (
    echo 사용법: upload-folder.bat "로컬폴더경로" "R2폴더경로"
    echo 예시: upload-folder.bat "C:\Videos\2024" "성인/2024"
    exit /b 1
)

set "LOCAL_FOLDER=%~1"
set "REMOTE_PATH=%~2"
set "COUNT=0"
set "SUCCESS=0"
set "FAILED=0"

echo.
echo ========================================
echo 폴더 업로드 시작
echo ========================================
echo 로컬 폴더: %LOCAL_FOLDER%
echo 업로드 경로: %REMOTE_PATH%
echo.

REM 폴더 존재 확인
if not exist "%LOCAL_FOLDER%" (
    echo [오류] 폴더를 찾을 수 없습니다: %LOCAL_FOLDER%
    exit /b 1
)

REM 영상 파일 개수 확인
for %%f in ("%LOCAL_FOLDER%\*.mp4" "%LOCAL_FOLDER%\*.mov" "%LOCAL_FOLDER%\*.avi" "%LOCAL_FOLDER%\*.mkv" "%LOCAL_FOLDER%\*.webm") do (
    set /a COUNT+=1
)

echo 발견된 영상 파일: %COUNT%개
echo.

set "CURRENT=0"
for %%f in ("%LOCAL_FOLDER%\*.mp4" "%LOCAL_FOLDER%\*.mov" "%LOCAL_FOLDER%\*.avi" "%LOCAL_FOLDER%\*.mkv" "%LOCAL_FOLDER%\*.webm") do (
    set /a CURRENT+=1
    echo [!CURRENT!/%COUNT%] %%~nxf 처리 중...
    
    set "THUMB_FILE=%TEMP%\%%~nxf.thumb.jpg"
    
    REM 썸네일 생성
    ffmpeg -y -i "%%f" -ss 00:00:01 -vframes 1 -vf "scale=480:-1" -q:v 3 "!THUMB_FILE!" -loglevel error
    
    if errorlevel 1 (
        echo      [실패] 썸네일 생성 실패
        set /a FAILED+=1
    ) else (
        REM 영상 업로드
        rclone copy "%%f" "r2:jbchbank/%REMOTE_PATH%/" -q
        
        REM 썸네일 업로드
        rclone copyto "!THUMB_FILE!" "r2:jbchbank/thumbnails/%REMOTE_PATH%/%%~nxf.jpg" -q
        
        del "!THUMB_FILE!" 2>nul
        
        echo      [완료]
        set /a SUCCESS+=1
    )
)

echo.
echo ========================================
echo 업로드 완료!
echo ========================================
echo 성공: %SUCCESS%개
echo 실패: %FAILED%개
echo.

endlocal
