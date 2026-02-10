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

# Windows에서 subprocess 콘솔 창 숨기기
if sys.platform == 'win32':
    SUBPROCESS_FLAGS = subprocess.CREATE_NO_WINDOW
else:
    SUBPROCESS_FLAGS = 0

# 설정
R2_BUCKET = "r2:jbch-word-bank-videos"
R2_PUBLIC_URL = "https://videos.haebomsoft.com"
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
    
    def upload_files(self, upload_path):
        total = len(self.selected_files)
        success = 0
        failed = 0
        
        self.log(f"업로드 시작: {total}개 파일 → {upload_path}")
        
        for i, file_path in enumerate(self.selected_files):
            filename = os.path.basename(file_path)
            self.status_label.configure(text=f"[{i+1}/{total}] {filename} 업로드 중...")
            self.progress_var.set((i / total) * 100)
            
            try:
                # 1. 영상 업로드
                self.log(f"[{i+1}/{total}] {filename} 업로드 중...")
                result = subprocess.run(
                    ["rclone", "copy", file_path, f"{R2_BUCKET}/{upload_path}/"],
                    capture_output=True, text=True, encoding='utf-8',
                    creationflags=SUBPROCESS_FLAGS
                )
                
                if result.returncode != 0:
                    self.log(f"  ❌ 업로드 실패: {result.stderr}")
                    failed += 1
                    continue
                
                # 2. 썸네일 생성 및 업로드
                if self.thumbnail_var.get():
                    self.log(f"  📷 썸네일 생성 중...")
                    thumb_path = os.path.join(os.environ.get('TEMP', '/tmp'), f"{filename}.thumb.jpg")
                    
                    # ffmpeg로 썸네일 생성
                    ffmpeg_result = subprocess.run(
                        ["ffmpeg", "-y", "-i", file_path, "-ss", "00:00:01", 
                         "-vframes", "1", "-vf", "scale=480:-1", "-q:v", "3", thumb_path],
                        capture_output=True, text=True, encoding='utf-8',
                        creationflags=SUBPROCESS_FLAGS
                    )
                    
                    if os.path.exists(thumb_path):
                        # 썸네일 업로드
                        thumb_result = subprocess.run(
                            ["rclone", "copyto", thumb_path, 
                             f"{R2_BUCKET}/thumbnails/{upload_path}/{filename}.jpg"],
                            capture_output=True, text=True, encoding='utf-8',
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


def main():
    root = tk.Tk()
    app = UploaderApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
