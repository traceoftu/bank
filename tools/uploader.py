# -*- coding: utf-8 -*-
"""
JBCH Word Bank 영상 업로더
- 파일/폴더 선택하여 R2에 업로드
- 썸네일 자동 생성 및 업로드
"""

import os
import sys
import subprocess
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
import json
import urllib.request
import urllib.error
import shutil
import glob
import tempfile
import hashlib

# Windows에서 subprocess 콘솔 창 숨기기
if sys.platform == 'win32':
    SUBPROCESS_FLAGS = subprocess.CREATE_NO_WINDOW
else:
    SUBPROCESS_FLAGS = 0

# 설정
R2_BUCKET = "r2:jbch-word-bank-videos"
R2_PUBLIC_URL = "https://videos.haebomsoft.com"
API_BASE_URL = "https://jbch.haebomsoft.com"  # 배포된 사이트 URL
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm'}

# R2 카테고리 목록
CATEGORIES = [
    "성인",
    "은장회", 
    "청년회",
    "중고등부",
    "초등부",
    "생활&특별&기타",
]


class UploaderApp:
    def __init__(self, root):
        self.root = root
        self.root.title("JBCH Word Bank 영상 업로더")
        self.root.geometry("700x600")
        self.root.resizable(True, True)
        
        self.selected_files = []
        self.is_uploading = False
        
        self.setup_ui()
        self.load_r2_folders()
    
    def setup_ui(self):
        # 메인 프레임
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # === 상단 헤더 (업로드 버튼 포함) ===
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(header_frame, text="JBCH Word Bank 영상 업로더", font=("", 12, "bold")).pack(side=tk.LEFT)
        self.upload_btn = ttk.Button(header_frame, text="🚀 업로드 시작", command=self.start_upload)
        self.upload_btn.pack(side=tk.RIGHT, ipadx=20, ipady=5)
        self.sync_btn = ttk.Button(header_frame, text="🔄 KV 동기화", command=self.sync_kv)
        self.sync_btn.pack(side=tk.RIGHT, padx=(0, 10))
        self.delete_btn = ttk.Button(header_frame, text="🗑️ 영상 삭제", command=self.open_delete_dialog)
        self.delete_btn.pack(side=tk.RIGHT, padx=(0, 10))
        
        # === 파일 선택 섹션 ===
        file_frame = ttk.LabelFrame(main_frame, text="1. 업로드할 파일/폴더 선택", padding="10")
        file_frame.pack(fill=tk.X, pady=(0, 10))
        
        btn_frame = ttk.Frame(file_frame)
        btn_frame.pack(fill=tk.X)
        
        ttk.Button(btn_frame, text="📁 파일 선택", command=self.select_files).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(btn_frame, text="📂 폴더 선택", command=self.select_folder).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(btn_frame, text="🗑️ 목록 초기화", command=self.clear_files).pack(side=tk.LEFT)
        
        # 선택된 파일 목록
        self.file_listbox = tk.Listbox(file_frame, height=6, selectmode=tk.EXTENDED)
        self.file_listbox.pack(fill=tk.X, pady=(10, 0))
        
        scrollbar = ttk.Scrollbar(file_frame, orient=tk.VERTICAL, command=self.file_listbox.yview)
        self.file_listbox.configure(yscrollcommand=scrollbar.set)
        
        self.file_count_label = ttk.Label(file_frame, text="선택된 파일: 0개")
        self.file_count_label.pack(anchor=tk.W, pady=(5, 0))
        
        # === 업로드 경로 섹션 ===
        path_frame = ttk.LabelFrame(main_frame, text="2. 업로드 경로 선택", padding="10")
        path_frame.pack(fill=tk.X, pady=(0, 10))
        
        # 카테고리 선택
        cat_frame = ttk.Frame(path_frame)
        cat_frame.pack(fill=tk.X)
        
        ttk.Label(cat_frame, text="카테고리:").pack(side=tk.LEFT)
        self.category_var = tk.StringVar()
        self.category_combo = ttk.Combobox(cat_frame, textvariable=self.category_var, values=CATEGORIES, width=20)
        self.category_combo.pack(side=tk.LEFT, padx=(5, 10))
        self.category_combo.bind("<<ComboboxSelected>>", self.on_category_change)
        
        ttk.Label(cat_frame, text="하위 폴더:").pack(side=tk.LEFT)
        self.subfolder_var = tk.StringVar()
        self.subfolder_combo = ttk.Combobox(cat_frame, textvariable=self.subfolder_var, width=30)
        self.subfolder_combo.pack(side=tk.LEFT, padx=(5, 0))
        
        # 새 폴더 입력
        new_folder_frame = ttk.Frame(path_frame)
        new_folder_frame.pack(fill=tk.X, pady=(10, 0))
        
        ttk.Label(new_folder_frame, text="새 폴더 생성:").pack(side=tk.LEFT)
        self.new_folder_var = tk.StringVar()
        ttk.Entry(new_folder_frame, textvariable=self.new_folder_var, width=30).pack(side=tk.LEFT, padx=(5, 0))
        ttk.Label(new_folder_frame, text="(비워두면 선택한 폴더에 업로드)").pack(side=tk.LEFT, padx=(5, 0))
        
        # 최종 경로 표시
        self.path_label = ttk.Label(path_frame, text="업로드 경로: (카테고리를 선택하세요)", foreground="gray")
        self.path_label.pack(anchor=tk.W, pady=(10, 0))
        
        # === 옵션 섹션 ===
        option_frame = ttk.LabelFrame(main_frame, text="3. 옵션", padding="10")
        option_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.thumbnail_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(option_frame, text="썸네일 자동 생성 및 업로드", variable=self.thumbnail_var).pack(anchor=tk.W)
        
        # 압축 옵션
        compress_frame = ttk.Frame(option_frame)
        compress_frame.pack(fill=tk.X, pady=(5, 0))
        
        self.compress_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(compress_frame, text="H.265 자동 압축 (NVENC GPU)", variable=self.compress_var).pack(side=tk.LEFT)
        
        ttk.Label(compress_frame, text="화질:").pack(side=tk.LEFT, padx=(20, 5))
        self.quality_var = tk.StringVar(value="균형 (CRF 23)")
        quality_combo = ttk.Combobox(compress_frame, textvariable=self.quality_var, width=20, state="readonly",
                                      values=["고화질 (CRF 18)", "균형 (CRF 23)", "용량 우선 (CRF 28)", "최대 압축 (CRF 32)"])
        quality_combo.pack(side=tk.LEFT, padx=(0, 10))
        
        ttk.Label(compress_frame, text="해상도:").pack(side=tk.LEFT, padx=(5, 5))
        self.resolution_var = tk.StringVar(value="원본")
        resolution_combo = ttk.Combobox(compress_frame, textvariable=self.resolution_var, width=15, state="readonly",
                                        values=["원본", "1080p (1920x1080)", "900p (1600x900)", "720p (1280x720)"])
        resolution_combo.pack(side=tk.LEFT)
        
        # === 진행 상황 ===
        progress_frame = ttk.LabelFrame(main_frame, text="4. 진행 상황", padding="10")
        progress_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(fill=tk.X)
        
        self.status_label = ttk.Label(progress_frame, text="대기 중...")
        self.status_label.pack(anchor=tk.W, pady=(5, 0))
        
        # 로그
        self.log_text = tk.Text(progress_frame, height=6, state=tk.DISABLED)
        self.log_text.pack(fill=tk.BOTH, expand=True, pady=(5, 0))
        
        log_scrollbar = ttk.Scrollbar(progress_frame, orient=tk.VERTICAL, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=log_scrollbar.set)
        
        # 이벤트 바인딩
        self.category_combo.bind("<KeyRelease>", lambda e: self.update_path_label())
        self.subfolder_combo.bind("<KeyRelease>", lambda e: self.update_path_label())
        self.new_folder_var.trace("w", lambda *args: self.update_path_label())
    
    def log(self, message):
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)
        self.root.update()
    
    def select_files(self):
        files = filedialog.askopenfilenames(
            title="영상 파일 선택",
            filetypes=[("영상 파일", "*.mp4 *.mov *.avi *.mkv *.webm"), ("모든 파일", "*.*")]
        )
        for f in files:
            if f not in self.selected_files:
                self.selected_files.append(f)
                self.file_listbox.insert(tk.END, os.path.basename(f))
        self.update_file_count()
    
    def select_folder(self):
        folder = filedialog.askdirectory(title="폴더 선택")
        if folder:
            for root, dirs, files in os.walk(folder):
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in VIDEO_EXTENSIONS:
                        full_path = os.path.join(root, f)
                        if full_path not in self.selected_files:
                            self.selected_files.append(full_path)
                            self.file_listbox.insert(tk.END, f)
        self.update_file_count()
    
    def clear_files(self):
        self.selected_files = []
        self.file_listbox.delete(0, tk.END)
        self.update_file_count()
    
    def update_file_count(self):
        count = len(self.selected_files)
        self.file_count_label.configure(text=f"선택된 파일: {count}개")
    
    def load_r2_folders(self):
        """R2에서 폴더 목록 로드"""
        try:
            result = subprocess.run(
                ["rclone", "lsf", R2_BUCKET, "--dirs-only"],
                capture_output=True, text=True, encoding='utf-8',
                creationflags=SUBPROCESS_FLAGS
            )
            if result.returncode == 0:
                folders = [f.rstrip('/') for f in result.stdout.strip().split('\n') if f]
                # 카테고리 목록 업데이트
                for folder in folders:
                    if folder not in CATEGORIES:
                        CATEGORIES.append(folder)
                self.category_combo['values'] = CATEGORIES
        except Exception as e:
            self.log(f"폴더 목록 로드 실패: {e}")
    
    def on_category_change(self, event=None):
        """카테고리 변경 시 하위 폴더 로드"""
        category = self.category_var.get()
        if not category:
            return
        
        try:
            result = subprocess.run(
                ["rclone", "lsf", f"{R2_BUCKET}/{category}", "--dirs-only", "-R"],
                capture_output=True, text=True, encoding='utf-8',
                creationflags=SUBPROCESS_FLAGS
            )
            if result.returncode == 0:
                subfolders = [f.rstrip('/') for f in result.stdout.strip().split('\n') if f]
                self.subfolder_combo['values'] = [""] + subfolders
                self.subfolder_var.set("")
        except Exception as e:
            self.log(f"하위 폴더 로드 실패: {e}")
        
        self.update_path_label()
    
    def update_path_label(self):
        """업로드 경로 라벨 업데이트"""
        category = self.category_var.get()
        subfolder = self.subfolder_var.get()
        new_folder = self.new_folder_var.get()
        
        if not category:
            self.path_label.configure(text="업로드 경로: (카테고리를 선택하세요)", foreground="gray")
            return
        
        path_parts = [category]
        if subfolder:
            path_parts.append(subfolder)
        if new_folder:
            path_parts.append(new_folder)
        
        full_path = "/".join(path_parts)
        self.path_label.configure(text=f"업로드 경로: {full_path}", foreground="blue")
    
    def get_upload_path(self):
        """최종 업로드 경로 반환"""
        category = self.category_var.get()
        subfolder = self.subfolder_var.get()
        new_folder = self.new_folder_var.get()
        
        if not category:
            return None
        
        path_parts = [category]
        if subfolder:
            path_parts.append(subfolder)
        if new_folder:
            path_parts.append(new_folder)
        
        return "/".join(path_parts)
    
    def start_upload(self):
        if self.is_uploading:
            return
        
        if not self.selected_files:
            messagebox.showwarning("경고", "업로드할 파일을 선택하세요.")
            return
        
        upload_path = self.get_upload_path()
        if not upload_path:
            messagebox.showwarning("경고", "업로드 경로를 선택하세요.")
            return
        
        self.is_uploading = True
        self.upload_btn.configure(state=tk.DISABLED)
        
        # 별도 스레드에서 업로드 실행
        thread = threading.Thread(target=self.upload_files, args=(upload_path,))
        thread.daemon = True
        thread.start()
    
    def get_crf_value(self):
        """화질 설정에서 CRF 값 추출"""
        quality = self.quality_var.get()
        if "18" in quality:
            return "18"
        elif "23" in quality:
            return "23"
        elif "28" in quality:
            return "28"
        else:
            return "32"  # 최대 압축
    
    def get_resolution_value(self):
        """해상도 설정에서 값 추출"""
        resolution = self.resolution_var.get()
        if "1080p" in resolution:
            return "1920x1080"
        elif "900p" in resolution:
            return "1600x900"
        elif "720p" in resolution:
            return "1280x720"
        else:
            return None  # 원본
    
    def get_video_codec(self, file_path):
        """ffprobe로 영상 코덱 확인"""
        try:
            cmd = [
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=codec_name",
                "-of", "default=noprint_wrappers=1:nokey=1",
                file_path
            ]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                creationflags=SUBPROCESS_FLAGS
            )
            if result.returncode == 0:
                return result.stdout.strip().lower()
        except:
            pass
        return "unknown"
    
    def should_skip_compression(self, file_path):
        """압축 스킵 여부 확인: 600MB 이하면 스킵 (이미 최적화된 파일)"""
        # 파일 크기 확인 (MB)
        file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
        
        # 코덱 확인
        codec = self.get_video_codec(file_path)
        
        # 600MB 이하면 스킵 (H.264, H.265 모두)
        if file_size_mb <= 600:
            return True, codec, file_size_mb
        
        return False, codec, file_size_mb
    
    def convert_to_hls(self, input_path, output_dir, codec="h264"):
        """MP4를 HLS(m3u8 + ts/fmp4)로 변환. H.265는 fMP4 세그먼트 사용 (TS는 HEVC 미지원)"""
        os.makedirs(output_dir, exist_ok=True)
        m3u8_path = os.path.join(output_dir, "index.m3u8")
        
        # ffmpeg는 경로 내 쉼표(,) 등 특수문자를 옵션 구분자로 해석하므로
        # 입력 파일을 안전한 임시 경로로 복사(하드링크)하여 사용
        safe_input = input_path
        temp_link = None
        if any(c in os.path.basename(input_path) for c in [',', ';', "'", '"']):
            temp_link = os.path.join(tempfile.gettempdir(), f"ffmpeg_input_{hashlib.md5(input_path.encode()).hexdigest()[:12]}.mp4")
            try:
                if os.path.exists(temp_link):
                    os.remove(temp_link)
                shutil.copy2(input_path, temp_link)
                safe_input = temp_link
            except Exception:
                safe_input = input_path
                temp_link = None
        
        is_hevc = codec.lower() in ("hevc", "h265", "h.265")
        
        if is_hevc:
            # fMP4 세그먼트: H.265 호환 (iOS Safari 지원)
            # init_filename을 output_dir 전체 경로로 지정
            init_path = os.path.join(output_dir, "init.mp4")
            cmd = [
                "ffmpeg", "-y",
                "-i", safe_input,
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "128k",
                "-hls_time", "10",
                "-hls_list_size", "0",
                "-hls_segment_type", "fmp4",
                "-hls_fmp4_init_filename", init_path,
                "-hls_segment_filename", os.path.join(output_dir, "seg_%03d.m4s"),
                "-f", "hls",
                m3u8_path
            ]
        else:
            # TS 세그먼트: H.264 (기존 방식)
            cmd = [
                "ffmpeg", "-y",
                "-i", safe_input,
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "128k",
                "-hls_time", "10",
                "-hls_list_size", "0",
                "-hls_segment_filename", os.path.join(output_dir, "seg_%03d.ts"),
                "-f", "hls",
                m3u8_path
            ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=False,
            creationflags=SUBPROCESS_FLAGS
        )
        
        # 임시 파일 정리
        if temp_link and os.path.exists(temp_link):
            try:
                os.remove(temp_link)
            except Exception:
                pass
        
        if result.returncode != 0:
            stderr = result.stderr.decode('utf-8', errors='replace') if result.stderr else ''
            self.log(f"  ⚠️ ffmpeg HLS 오류: {stderr[-500:]}")
            return False
        
        # fMP4: m3u8 내의 init.mp4 전체 경로를 상대 경로로 수정
        if is_hevc and os.path.exists(m3u8_path):
            with open(m3u8_path, 'r', encoding='utf-8') as f:
                content = f.read()
            # 전체 경로를 상대 경로 "init.mp4"로 치환
            init_abs = os.path.join(output_dir, "init.mp4").replace('\\', '/')
            content = content.replace(init_abs, "init.mp4")
            init_abs_win = os.path.join(output_dir, "init.mp4")
            content = content.replace(init_abs_win, "init.mp4")
            with open(m3u8_path, 'w', encoding='utf-8') as f:
                f.write(content)
        
        return os.path.exists(m3u8_path)
    
    def upload_hls_files(self, hls_dir, remote_path):
        """HLS 파일들을 R2에 업로드"""
        # rclone copy로 폴더 전체 업로드
        result = subprocess.run(
            ["rclone", "copy", hls_dir, f"{R2_BUCKET}/{remote_path}/",
             "--transfers", "8", "--checkers", "16"],
            capture_output=True, text=False,
            creationflags=SUBPROCESS_FLAGS
        )
        return result.returncode == 0
    
    def compress_video(self, input_path, output_path):
        """NVENC H.265로 영상 압축"""
        crf = self.get_crf_value()
        resolution = self.get_resolution_value()
        
        # 비트레이트 제한 설정 (CRF별)
        # CRF 18: 고화질 - 8Mbps / CRF 23: 균형 - 4Mbps / CRF 28: 용량우선 - 2Mbps / CRF 32: 최대 압축 - 1Mbps
        bitrate_map = {"18": "8M", "23": "4M", "28": "2M", "32": "1M"}
        maxrate = bitrate_map.get(crf, "4M")
        bufsize = maxrate  # bufsize = maxrate와 동일
        
        # NVENC H.265 압축 명령어 (VBR 모드 + 비트레이트 제한)
        cmd = [
            "ffmpeg", "-y",
            "-hwaccel", "cuda",
            "-i", input_path,
            "-c:v", "hevc_nvenc",
            "-preset", "p4",
            "-rc", "vbr",
            "-cq", crf,
            "-maxrate", maxrate,
            "-bufsize", bufsize,
            "-c:a", "aac",
            "-b:a", "128k"
        ]
        
        # 해상도 변경 옵션 추가
        if resolution:
            cmd.extend(["-vf", f"scale={resolution}"])
        
        cmd.append(output_path)
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=False,
            creationflags=SUBPROCESS_FLAGS
        )
        
        return result.returncode == 0
    
    def upload_files(self, upload_path):
        total = len(self.selected_files)
        success = 0
        failed = 0
        
        self.log(f"업로드 시작: {total}개 파일 → {upload_path}")
        
        for i, file_path in enumerate(self.selected_files):
            filename = os.path.basename(file_path)
            self.status_label.configure(text=f"[{i+1}/{total}] {filename} 처리 중...")
            self.progress_var.set((i / total) * 100)
            
            try:
                actual_file = file_path
                compressed_path = None
                
                # 압축 옵션이 켜져 있으면 먼저 압축
                if self.compress_var.get():
                    # 코덱 및 크기 체크 - H.265/HEVC이고 600MB 이하면 스킵
                    skip, codec, file_size_mb = self.should_skip_compression(file_path)
                    
                    if skip:
                        self.log(f"[{i+1}/{total}] {filename} - HEVC {file_size_mb:.0f}MB (압축 불필요)")
                    else:
                        self.log(f"[{i+1}/{total}] {filename} 압축 중... ({codec} → H.265 NVENC)")
                        self.status_label.configure(text=f"[{i+1}/{total}] {filename} 압축 중...")
                        
                        # 압축된 파일 경로 (특수문자 제거 - ffmpeg 호환)
                        name, ext = os.path.splitext(filename)
                        safe_compress_name = hashlib.md5(name.encode('utf-8')).hexdigest()[:12]
                        compressed_path = os.path.join(os.environ.get('TEMP', '/tmp'), f"{safe_compress_name}_compressed.mp4")
                        
                        # 원본 크기
                        original_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
                        
                        if self.compress_video(file_path, compressed_path):
                            if os.path.exists(compressed_path):
                                compressed_size = os.path.getsize(compressed_path) / (1024 * 1024)  # MB
                                
                                # 압축 결과가 원본보다 크면 원본 사용
                                if compressed_size >= original_size:
                                    self.log(f"  ⚠️ 이미 최적화된 파일 (압축 스킵): {original_size:.1f}MB")
                                    try:
                                        os.remove(compressed_path)
                                    except:
                                        pass
                                    compressed_path = None
                                else:
                                    reduction = (1 - compressed_size / original_size) * 100
                                    self.log(f"  ✅ 압축 완료: {original_size:.1f}MB → {compressed_size:.1f}MB ({reduction:.0f}% 감소)")
                                    actual_file = compressed_path
                            else:
                                self.log(f"  ⚠️ 압축 실패, 원본으로 업로드")
                        else:
                            self.log(f"  ⚠️ 압축 실패, 원본으로 업로드")
                
                # 1. HLS 변환 및 업로드
                # 코덱 확인: 압축했으면 항상 hevc, 아니면 원본 코덱 확인
                if compressed_path and actual_file == compressed_path:
                    video_codec = "hevc"
                else:
                    video_codec = self.get_video_codec(actual_file)
                
                self.log(f"[{i+1}/{total}] {filename} HLS 변환 중... (코덱: {video_codec})")
                self.status_label.configure(text=f"[{i+1}/{total}] {filename} HLS 변환 중...")
                
                # HLS 변환용 임시 디렉토리 (특수문자 제거 - ffmpeg가 쉼표 등을 구분자로 해석)
                name_without_ext = os.path.splitext(filename)[0]
                safe_name = hashlib.md5(name_without_ext.encode('utf-8')).hexdigest()[:12]
                hls_temp_dir = os.path.join(tempfile.gettempdir(), f"hls_{safe_name}")
                
                # 기존 임시 디렉토리 정리
                if os.path.exists(hls_temp_dir):
                    shutil.rmtree(hls_temp_dir, ignore_errors=True)
                
                hls_success = self.convert_to_hls(actual_file, hls_temp_dir, codec=video_codec)
                
                if not hls_success:
                    self.log(f"  ⚠️ HLS 변환 실패, 원본 MP4로 업로드")
                    # 폴백: 원본 MP4 업로드
                    result = subprocess.run(
                        ["rclone", "copy", actual_file, f"{R2_BUCKET}/{upload_path}/"],
                        capture_output=True, text=False,
                        creationflags=SUBPROCESS_FLAGS
                    )
                    if result.returncode != 0:
                        self.log(f"  ❌ 업로드 실패")
                        failed += 1
                        shutil.rmtree(hls_temp_dir, ignore_errors=True)
                        continue
                else:
                    # 원본 MP4도 업로드 (다운로드용) - 원본 파일명으로 업로드
                    self.log(f"  📤 원본 MP4 업로드 중...")
                    mp4_remote_path = f"{R2_BUCKET}/{upload_path}/{filename}"
                    result = subprocess.run(
                        ["rclone", "copyto", actual_file, mp4_remote_path],
                        capture_output=True, text=False,
                        creationflags=SUBPROCESS_FLAGS
                    )
                    if result.returncode != 0:
                        self.log(f"  ⚠️ 원본 MP4 업로드 실패")
                    else:
                        self.log(f"  ✅ 원본 MP4 업로드 완료")
                    
                    # HLS 파일 업로드
                    ts_files = glob.glob(os.path.join(hls_temp_dir, "*.ts"))
                    m4s_files = glob.glob(os.path.join(hls_temp_dir, "*.m4s"))
                    init_files = glob.glob(os.path.join(hls_temp_dir, "init.mp4"))
                    seg_count = len(ts_files) + len(m4s_files)
                    all_hls_files = os.listdir(hls_temp_dir) if os.path.exists(hls_temp_dir) else []
                    self.log(f"  � HLS 파일: {all_hls_files}")
                    self.log(f"  �� HLS 업로드 중... (m3u8 + {seg_count}개 세그먼트)")
                    self.status_label.configure(text=f"[{i+1}/{total}] {filename} HLS 업로드 중...")
                    
                    hls_remote_path = f"{upload_path}/hls/{name_without_ext}"
                    if not self.upload_hls_files(hls_temp_dir, hls_remote_path):
                        self.log(f"  ❌ HLS 업로드 실패")
                        failed += 1
                        shutil.rmtree(hls_temp_dir, ignore_errors=True)
                        continue
                    
                    self.log(f"  ✅ HLS 업로드 완료")
                
                # 압축 파일 삭제 (업로드 완료 후)
                if compressed_path and os.path.exists(compressed_path):
                    try:
                        os.remove(compressed_path)
                    except:
                        pass
                
                # HLS 임시 디렉토리 정리
                shutil.rmtree(hls_temp_dir, ignore_errors=True)
                
                upload_failed = False
                if upload_failed:
                    continue
                
                # 2. 썸네일 생성 및 업로드
                if self.thumbnail_var.get():
                    self.log(f"  📷 썸네일 생성 중...")
                    thumb_path = os.path.join(os.environ.get('TEMP', '/tmp'), f"{filename}.thumb.jpg")
                    
                    # ffmpeg로 썸네일 생성
                    ffmpeg_result = subprocess.run(
                        ["ffmpeg", "-y", "-i", file_path, "-ss", "00:00:01", 
                         "-vframes", "1", "-vf", "scale=480:-1", "-q:v", "3", thumb_path],
                        capture_output=True, text=False,
                        creationflags=SUBPROCESS_FLAGS
                    )
                    
                    if os.path.exists(thumb_path):
                        # 썸네일 업로드
                        remote_thumb_path = f"{R2_BUCKET}/thumbnails/{upload_path}/{filename}.jpg"
                        thumb_result = subprocess.run(
                            ["rclone", "copyto", thumb_path, remote_thumb_path],
                            capture_output=True, text=False,
                            creationflags=SUBPROCESS_FLAGS
                        )
                        
                        if thumb_result.returncode == 0:
                            self.log(f"  ✅ 썸네일 업로드 완료")
                        else:
                            self.log(f"  ⚠️ 썸네일 업로드 실패")
                        
                        # 임시 파일 삭제
                        try:
                            os.remove(thumb_path)
                        except:
                            pass
                    else:
                        self.log(f"  ⚠️ 썸네일 생성 실패")
                
                self.log(f"  ✅ 완료")
                success += 1
                
                # 3. KV에 파일 정보 등록
                if hls_success:
                    self.register_file_to_kv(upload_path, filename, hls_path=f"{upload_path}/hls/{name_without_ext}/index.m3u8")
                else:
                    self.register_file_to_kv(upload_path, filename)
                
            except Exception as e:
                self.log(f"  ❌ 오류: {e}")
                failed += 1
        
        self.progress_var.set(100)
        self.status_label.configure(text=f"완료! 성공: {success}개, 실패: {failed}개")
        self.log(f"\n========================================")
        self.log(f"업로드 완료! 성공: {success}개, 실패: {failed}개")
        self.log(f"========================================")
        
        self.is_uploading = False
        self.upload_btn.configure(state=tk.NORMAL)
        
        messagebox.showinfo("완료", f"업로드 완료!\n성공: {success}개\n실패: {failed}개")
    
    def register_file_to_kv(self, upload_path, filename, hls_path=None):
        """KV에 파일 정보 등록"""
        try:
            # 카테고리 추출 (upload_path의 첫 번째 부분)
            category = upload_path.split('/')[0]
            
            # 파일 정보 (path는 항상 MP4 경로, HLS는 별도 필드)
            file_info = {
                "path": f"{upload_path}/{filename}",
                "name": filename,
                "size": 0,
                "category": category
            }
            if hls_path:
                file_info["hls"] = hls_path
            
            # API 호출
            data = json.dumps({
                "action": "add",
                "file": file_info
            }).encode('utf-8')
            
            req = urllib.request.Request(
                f"{API_BASE_URL}/api/videos/files",
                data=data,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'JBCH-Uploader/1.0'
                },
                method='POST'
            )
            
            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode('utf-8'))
                if result.get('success'):
                    self.log(f"  📝 KV 등록 완료")
                else:
                    self.log(f"  ⚠️ KV 등록 실패: {result}")
                    
        except Exception as e:
            self.log(f"  ⚠️ KV 등록 오류: {e}")
    
    def sync_kv(self):
        """R2에서 KV로 파일 목록 동기화"""
        if self.is_uploading:
            messagebox.showwarning("경고", "업로드 중에는 동기화할 수 없습니다.")
            return
        
        self.sync_btn.configure(state=tk.DISABLED)
        self.log("🔄 KV 동기화 시작...")
        
        def do_sync():
            try:
                data = json.dumps({"action": "sync"}).encode('utf-8')
                req = urllib.request.Request(
                    f"{API_BASE_URL}/api/videos/files",
                    data=data,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'JBCH-Uploader/1.0'
                    },
                    method='POST'
                )
                
                with urllib.request.urlopen(req, timeout=120) as response:
                    result = json.loads(response.read().decode('utf-8'))
                    if result.get('success'):
                        count = result.get('count', 0)
                        self.log(f"✅ KV 동기화 완료! ({count}개 파일)")
                        messagebox.showinfo("완료", f"KV 동기화 완료!\n{count}개 파일이 등록되었습니다.")
                    else:
                        error_msg = result.get('error', str(result))
                        self.log(f"❌ KV 동기화 실패: {error_msg}")
                        messagebox.showerror("오류", f"동기화 실패: {error_msg}")
                        
            except urllib.error.HTTPError as e:
                body = e.read().decode('utf-8', errors='replace')
                self.log(f"❌ KV 동기화 HTTP 오류: {e.code} {body}")
                messagebox.showerror("오류", f"동기화 HTTP 오류: {e.code}\n{body[:200]}")
            except Exception as e:
                self.log(f"❌ KV 동기화 오류: {e}")
                messagebox.showerror("오류", f"동기화 오류: {e}")
            finally:
                self.sync_btn.configure(state=tk.NORMAL)
        
        # 별도 스레드에서 실행
        thread = threading.Thread(target=do_sync)
        thread.daemon = True
        thread.start()
    
    def open_delete_dialog(self):
        """영상 삭제 다이얼로그 열기"""
        if self.is_uploading:
            messagebox.showwarning("경고", "업로드 중에는 삭제할 수 없습니다.")
            return
        
        # 새 창 생성
        dialog = tk.Toplevel(self.root)
        dialog.title("영상 삭제")
        dialog.geometry("600x500")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # 카테고리 선택
        cat_frame = ttk.Frame(dialog, padding="10")
        cat_frame.pack(fill=tk.X)
        
        ttk.Label(cat_frame, text="카테고리:").pack(side=tk.LEFT)
        cat_var = tk.StringVar()
        cat_combo = ttk.Combobox(cat_frame, textvariable=cat_var, values=CATEGORIES, width=20)
        cat_combo.pack(side=tk.LEFT, padx=(5, 10))
        
        ttk.Label(cat_frame, text="하위 폴더:").pack(side=tk.LEFT)
        subfolder_var = tk.StringVar()
        subfolder_combo = ttk.Combobox(cat_frame, textvariable=subfolder_var, width=25)
        subfolder_combo.pack(side=tk.LEFT, padx=(5, 10))
        
        load_btn = ttk.Button(cat_frame, text="📂 파일 목록 조회")
        load_btn.pack(side=tk.LEFT)
        
        # 파일 목록
        list_frame = ttk.LabelFrame(dialog, text="삭제할 파일 선택", padding="10")
        list_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        file_listbox = tk.Listbox(list_frame, height=15, selectmode=tk.EXTENDED)
        file_listbox.pack(fill=tk.BOTH, expand=True)
        
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=file_listbox.yview)
        file_listbox.configure(yscrollcommand=scrollbar.set)
        
        # 파일 경로 저장용
        file_paths = []
        
        def on_category_change(event=None):
            category = cat_var.get()
            if not category:
                return
            try:
                result = subprocess.run(
                    ["rclone", "lsf", f"{R2_BUCKET}/{category}", "--dirs-only", "-R"],
                    capture_output=True, text=True, encoding='utf-8',
                    creationflags=SUBPROCESS_FLAGS
                )
                if result.returncode == 0:
                    subfolders = [f.rstrip('/') for f in result.stdout.strip().split('\n') if f]
                    subfolder_combo['values'] = [""] + subfolders
                    subfolder_var.set("")
            except Exception as e:
                pass
        
        def load_files():
            category = cat_var.get()
            subfolder = subfolder_var.get()
            if not category:
                messagebox.showwarning("경고", "카테고리를 선택하세요.")
                return
            
            file_listbox.delete(0, tk.END)
            file_paths.clear()
            
            path = f"{category}/{subfolder}" if subfolder else category
            
            try:
                result = subprocess.run(
                    ["rclone", "lsf", f"{R2_BUCKET}/{path}", "--files-only"],
                    capture_output=True, text=True, encoding='utf-8',
                    creationflags=SUBPROCESS_FLAGS
                )
                if result.returncode == 0:
                    files = [f for f in result.stdout.strip().split('\n') if f and f.endswith(('.mp4', '.mkv', '.avi', '.mov', '.webm'))]
                    for f in files:
                        file_listbox.insert(tk.END, f)
                        file_paths.append(f"{path}/{f}")
                    
                    if not files:
                        messagebox.showinfo("알림", "해당 경로에 영상 파일이 없습니다.")
            except Exception as e:
                messagebox.showerror("오류", f"파일 목록 조회 실패: {e}")
        
        def delete_selected():
            selected_indices = file_listbox.curselection()
            if not selected_indices:
                messagebox.showwarning("경고", "삭제할 파일을 선택하세요.")
                return
            
            selected_files = [file_paths[i] for i in selected_indices]
            
            if not messagebox.askyesno("확인", f"{len(selected_files)}개 파일을 삭제하시겠습니까?\n\n영상 파일과 썸네일이 함께 삭제됩니다."):
                return
            
            success = 0
            failed = 0
            
            for file_path in selected_files:
                try:
                    # 1. 영상 파일 삭제
                    result = subprocess.run(
                        ["rclone", "deletefile", f"{R2_BUCKET}/{file_path}"],
                        capture_output=True, text=False,
                        creationflags=SUBPROCESS_FLAGS
                    )
                    
                    # 2. HLS 폴더 삭제 (hls/영상명 폴더에 m3u8 + ts 파일들)
                    name_without_ext = os.path.splitext(os.path.basename(file_path))[0]
                    dir_path = os.path.dirname(file_path)
                    hls_folder = f"{dir_path}/hls/{name_without_ext}" if dir_path else f"hls/{name_without_ext}"
                    subprocess.run(
                        ["rclone", "purge", f"{R2_BUCKET}/{hls_folder}"],
                        capture_output=True, text=False,
                        creationflags=SUBPROCESS_FLAGS
                    )
                    
                    # 3. 썸네일 삭제
                    thumb_path = f"thumbnails/{file_path}.jpg"
                    subprocess.run(
                        ["rclone", "deletefile", f"{R2_BUCKET}/{thumb_path}"],
                        capture_output=True, text=False,
                        creationflags=SUBPROCESS_FLAGS
                    )
                    
                    if result.returncode == 0:
                        success += 1
                    else:
                        failed += 1
                except Exception as e:
                    failed += 1
            
            dialog.destroy()
            self.log(f"🗑️ {success}개 파일 삭제 완료")
            
            # 자동으로 KV 동기화 실행
            self.log("🔄 KV 자동 동기화 중...")
            try:
                data = json.dumps({"action": "sync"}).encode('utf-8')
                req = urllib.request.Request(
                    f"{API_BASE_URL}/api/videos/files",
                    data=data,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'JBCH-Uploader/1.0'
                    },
                    method='POST'
                )
                with urllib.request.urlopen(req, timeout=120) as response:
                    result = json.loads(response.read().decode('utf-8'))
                    if result.get('success'):
                        count = result.get('count', 0)
                        self.log(f"✅ KV 동기화 완료! ({count}개 파일)")
                        messagebox.showinfo("완료", f"삭제 완료!\n성공: {success}개\n실패: {failed}개\n\nKV 동기화 완료 ({count}개 파일)")
                    else:
                        error_msg = result.get('error', str(result))
                        self.log(f"⚠️ KV 동기화 실패: {error_msg}")
                        messagebox.showinfo("완료", f"삭제 완료!\n성공: {success}개\n실패: {failed}개\n\n⚠️ KV 동기화 실패 - 수동으로 동기화해주세요.")
            except urllib.error.HTTPError as e:
                body = e.read().decode('utf-8', errors='replace')
                self.log(f"⚠️ KV 동기화 HTTP 오류: {e.code} {body}")
                messagebox.showinfo("완료", f"삭제 완료!\n성공: {success}개\n실패: {failed}개\n\n⚠️ KV 동기화 오류({e.code}) - 수동으로 동기화해주세요.")
            except Exception as e:
                self.log(f"⚠️ KV 동기화 오류: {e}")
                messagebox.showinfo("완료", f"삭제 완료!\n성공: {success}개\n실패: {failed}개\n\n⚠️ KV 동기화 오류 - 수동으로 동기화해주세요.")
        
        cat_combo.bind("<<ComboboxSelected>>", on_category_change)
        load_btn.configure(command=load_files)
        
        # 버튼
        btn_frame = ttk.Frame(dialog, padding="10")
        btn_frame.pack(fill=tk.X)
        
        ttk.Button(btn_frame, text="🗑️ 선택 파일 삭제", command=delete_selected).pack(side=tk.RIGHT, padx=(5, 0))
        ttk.Button(btn_frame, text="취소", command=dialog.destroy).pack(side=tk.RIGHT)


def main():
    root = tk.Tk()
    app = UploaderApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
