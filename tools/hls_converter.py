# -*- coding: utf-8 -*-
"""
기존 R2 영상을 HLS로 변환하는 도구
- R2에서 MP4 다운로드
- ffmpeg로 HLS 변환 (m3u8 + ts)
- HLS 파일을 R2에 업로드
- 원본 MP4 삭제 (선택)
- KV 동기화
"""

import os
import sys
import subprocess
import shutil
import glob
import tempfile
import json
import urllib.request
import tkinter as tk
from tkinter import ttk, messagebox
import threading

# Windows에서 subprocess 콘솔 창 숨기기
if sys.platform == 'win32':
    SUBPROCESS_FLAGS = subprocess.CREATE_NO_WINDOW
else:
    SUBPROCESS_FLAGS = 0

# 설정
R2_BUCKET = "r2:jbch-word-bank-videos"
R2_PUBLIC_URL = "https://videos.haebomsoft.com"
API_BASE_URL = "https://jbch.haebomsoft.com"
VIDEO_EXTENSIONS = ('.mp4', '.mov', '.avi', '.mkv', '.webm')


class HLSConverterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("HLS 변환 도구 - 기존 영상 변환")
        self.root.geometry("700x550")
        self.root.resizable(True, True)
        
        self.is_converting = False
        self.file_paths = []
        
        self.setup_ui()
    
    def setup_ui(self):
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 헤더
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 10))
        ttk.Label(header_frame, text="기존 영상 HLS 변환 도구", font=("", 12, "bold")).pack(side=tk.LEFT)
        
        # 카테고리 선택
        cat_frame = ttk.LabelFrame(main_frame, text="1. R2 경로 선택", padding="10")
        cat_frame.pack(fill=tk.X, pady=(0, 10))
        
        row1 = ttk.Frame(cat_frame)
        row1.pack(fill=tk.X)
        
        ttk.Label(row1, text="카테고리:").pack(side=tk.LEFT)
        self.category_var = tk.StringVar()
        self.category_combo = ttk.Combobox(row1, textvariable=self.category_var, width=20)
        self.category_combo.pack(side=tk.LEFT, padx=(5, 10))
        self.category_combo.bind("<<ComboboxSelected>>", self.on_category_change)
        
        ttk.Label(row1, text="하위 폴더:").pack(side=tk.LEFT)
        self.subfolder_var = tk.StringVar()
        self.subfolder_combo = ttk.Combobox(row1, textvariable=self.subfolder_var, width=25)
        self.subfolder_combo.pack(side=tk.LEFT, padx=(5, 10))
        
        self.load_btn = ttk.Button(row1, text="📂 파일 목록 조회", command=self.load_files)
        self.load_btn.pack(side=tk.LEFT)
        
        # 파일 목록
        list_frame = ttk.LabelFrame(main_frame, text="2. 변환할 파일 선택 (MP4만 표시)", padding="10")
        list_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        # 전체 선택/해제 버튼
        sel_frame = ttk.Frame(list_frame)
        sel_frame.pack(fill=tk.X, pady=(0, 5))
        ttk.Button(sel_frame, text="전체 선택", command=self.select_all).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(sel_frame, text="전체 해제", command=self.deselect_all).pack(side=tk.LEFT)
        self.file_count_label = ttk.Label(sel_frame, text="파일: 0개")
        self.file_count_label.pack(side=tk.RIGHT)
        
        self.file_listbox = tk.Listbox(list_frame, height=10, selectmode=tk.EXTENDED)
        self.file_listbox.pack(fill=tk.BOTH, expand=True)
        
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.file_listbox.yview)
        self.file_listbox.configure(yscrollcommand=scrollbar.set)
        
        # 옵션
        option_frame = ttk.LabelFrame(main_frame, text="3. 옵션", padding="10")
        option_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.delete_original_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(option_frame, text="변환 후 원본 MP4 삭제 (권장)", variable=self.delete_original_var).pack(anchor=tk.W)
        
        self.sync_kv_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(option_frame, text="변환 완료 후 KV 자동 동기화", variable=self.sync_kv_var).pack(anchor=tk.W)
        
        # 진행 상황
        progress_frame = ttk.LabelFrame(main_frame, text="4. 진행 상황", padding="10")
        progress_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(fill=tk.X)
        
        self.status_label = ttk.Label(progress_frame, text="대기 중...")
        self.status_label.pack(anchor=tk.W, pady=(5, 0))
        
        self.log_text = tk.Text(progress_frame, height=5, state=tk.DISABLED)
        self.log_text.pack(fill=tk.X, pady=(5, 0))
        
        # 버튼
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X)
        
        self.convert_btn = ttk.Button(btn_frame, text="🚀 HLS 변환 시작", command=self.start_convert)
        self.convert_btn.pack(side=tk.RIGHT, ipadx=20, ipady=5)
        
        # 카테고리 로드
        self.load_categories()
    
    def log(self, message):
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)
        self.root.update()
    
    def load_categories(self):
        try:
            result = subprocess.run(
                ["rclone", "lsf", R2_BUCKET, "--dirs-only"],
                capture_output=True, text=True, encoding='utf-8',
                creationflags=SUBPROCESS_FLAGS
            )
            if result.returncode == 0:
                folders = [f.rstrip('/') for f in result.stdout.strip().split('\n') if f and not f.startswith('thumbnails')]
                self.category_combo['values'] = folders
        except Exception as e:
            self.log(f"카테고리 로드 실패: {e}")
    
    def on_category_change(self, event=None):
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
        except:
            pass
    
    def load_files(self):
        category = self.category_var.get()
        subfolder = self.subfolder_var.get()
        if not category:
            messagebox.showwarning("경고", "카테고리를 선택하세요.")
            return
        
        self.file_listbox.delete(0, tk.END)
        self.file_paths.clear()
        
        path = f"{category}/{subfolder}" if subfolder else category
        
        try:
            result = subprocess.run(
                ["rclone", "lsf", f"{R2_BUCKET}/{path}", "--files-only", "-R"],
                capture_output=True, text=True, encoding='utf-8',
                creationflags=SUBPROCESS_FLAGS
            )
            if result.returncode == 0:
                files = [f for f in result.stdout.strip().split('\n') 
                         if f and f.lower().endswith(VIDEO_EXTENSIONS) and '/seg_' not in f and '.m3u8' not in f]
                for f in files:
                    self.file_listbox.insert(tk.END, f)
                    self.file_paths.append(f"{path}/{f}")
                
                self.file_count_label.configure(text=f"파일: {len(files)}개")
                
                if not files:
                    messagebox.showinfo("알림", "변환할 MP4 파일이 없습니다.\n(이미 HLS로 변환된 파일은 제외됩니다)")
        except Exception as e:
            messagebox.showerror("오류", f"파일 목록 조회 실패: {e}")
    
    def select_all(self):
        self.file_listbox.select_set(0, tk.END)
    
    def deselect_all(self):
        self.file_listbox.select_clear(0, tk.END)
    
    def start_convert(self):
        if self.is_converting:
            return
        
        selected_indices = self.file_listbox.curselection()
        if not selected_indices:
            messagebox.showwarning("경고", "변환할 파일을 선택하세요.")
            return
        
        selected_files = [self.file_paths[i] for i in selected_indices]
        
        if not messagebox.askyesno("확인", f"{len(selected_files)}개 파일을 HLS로 변환하시겠습니까?"):
            return
        
        self.is_converting = True
        self.convert_btn.configure(state=tk.DISABLED)
        
        thread = threading.Thread(target=self.convert_files, args=(selected_files,))
        thread.daemon = True
        thread.start()
    
    def convert_files(self, files):
        total = len(files)
        success = 0
        failed = 0
        
        self.log(f"HLS 변환 시작: {total}개 파일")
        
        for i, remote_path in enumerate(files):
            filename = os.path.basename(remote_path)
            name_without_ext = os.path.splitext(filename)[0]
            remote_dir = os.path.dirname(remote_path)
            
            self.status_label.configure(text=f"[{i+1}/{total}] {filename}")
            self.progress_var.set((i / total) * 100)
            
            try:
                # 1. R2에서 MP4 다운로드
                self.log(f"[{i+1}/{total}] {filename} 다운로드 중...")
                temp_dir = tempfile.mkdtemp(prefix="hls_conv_")
                local_mp4 = os.path.join(temp_dir, filename)
                
                result = subprocess.run(
                    ["rclone", "copy", f"{R2_BUCKET}/{remote_path}", temp_dir],
                    capture_output=True, text=False,
                    creationflags=SUBPROCESS_FLAGS
                )
                
                if result.returncode != 0 or not os.path.exists(local_mp4):
                    self.log(f"  ❌ 다운로드 실패")
                    failed += 1
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    continue
                
                file_size_mb = os.path.getsize(local_mp4) / (1024 * 1024)
                self.log(f"  📥 다운로드 완료 ({file_size_mb:.0f}MB)")
                
                # 2. HLS 변환
                self.log(f"  🔄 HLS 변환 중...")
                self.status_label.configure(text=f"[{i+1}/{total}] {filename} HLS 변환 중...")
                
                hls_dir = os.path.join(temp_dir, "hls")
                os.makedirs(hls_dir, exist_ok=True)
                m3u8_path = os.path.join(hls_dir, "index.m3u8")
                
                cmd = [
                    "ffmpeg", "-y",
                    "-i", local_mp4,
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-b:a", "128k",
                    "-hls_time", "10",
                    "-hls_list_size", "0",
                    "-hls_segment_filename", os.path.join(hls_dir, "seg_%03d.ts"),
                    "-f", "hls",
                    m3u8_path
                ]
                
                conv_result = subprocess.run(
                    cmd, capture_output=True, text=False,
                    creationflags=SUBPROCESS_FLAGS
                )
                
                if conv_result.returncode != 0 or not os.path.exists(m3u8_path):
                    self.log(f"  ❌ HLS 변환 실패")
                    failed += 1
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    continue
                
                ts_files = glob.glob(os.path.join(hls_dir, "*.ts"))
                self.log(f"  ✅ HLS 변환 완료 (m3u8 + {len(ts_files)}개 세그먼트)")
                
                # 3. HLS 파일 업로드
                self.log(f"  📤 HLS 업로드 중...")
                self.status_label.configure(text=f"[{i+1}/{total}] {filename} HLS 업로드 중...")
                
                hls_remote_path = f"{remote_dir}/hls/{name_without_ext}"
                upload_result = subprocess.run(
                    ["rclone", "copy", hls_dir, f"{R2_BUCKET}/{hls_remote_path}/",
                     "--transfers", "8", "--checkers", "16"],
                    capture_output=True, text=False,
                    creationflags=SUBPROCESS_FLAGS
                )
                
                if upload_result.returncode != 0:
                    self.log(f"  ❌ HLS 업로드 실패")
                    failed += 1
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    continue
                
                self.log(f"  ✅ HLS 업로드 완료")
                
                # 4. 원본 MP4 삭제
                if self.delete_original_var.get():
                    self.log(f"  🗑️ 원본 MP4 삭제 중...")
                    del_result = subprocess.run(
                        ["rclone", "deletefile", f"{R2_BUCKET}/{remote_path}"],
                        capture_output=True, text=False,
                        creationflags=SUBPROCESS_FLAGS
                    )
                    if del_result.returncode == 0:
                        self.log(f"  ✅ 원본 삭제 완료")
                    else:
                        self.log(f"  ⚠️ 원본 삭제 실패 (수동 삭제 필요)")
                
                # 임시 파일 정리
                shutil.rmtree(temp_dir, ignore_errors=True)
                
                success += 1
                self.log(f"  ✅ 완료!")
                
            except Exception as e:
                self.log(f"  ❌ 오류: {e}")
                failed += 1
        
        self.progress_var.set(100)
        
        # 5. KV 동기화
        if self.sync_kv_var.get() and success > 0:
            self.log("🔄 KV 동기화 중...")
            self.status_label.configure(text="KV 동기화 중...")
            try:
                data = json.dumps({"action": "sync"}).encode('utf-8')
                req = urllib.request.Request(
                    f"{API_BASE_URL}/api/videos/files",
                    data=data,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'JBCH-HLS-Converter/1.0'
                    },
                    method='POST'
                )
                with urllib.request.urlopen(req, timeout=60) as response:
                    result = json.loads(response.read().decode('utf-8'))
                    if result.get('success'):
                        count = result.get('count', 0)
                        self.log(f"✅ KV 동기화 완료! ({count}개 파일)")
                    else:
                        self.log(f"⚠️ KV 동기화 실패")
            except Exception as e:
                self.log(f"⚠️ KV 동기화 오류: {e}")
        
        self.status_label.configure(text=f"완료! 성공: {success}개, 실패: {failed}개")
        self.log(f"\n========================================")
        self.log(f"HLS 변환 완료! 성공: {success}개, 실패: {failed}개")
        self.log(f"========================================")
        
        self.is_converting = False
        self.convert_btn.configure(state=tk.NORMAL)
        
        messagebox.showinfo("완료", f"HLS 변환 완료!\n성공: {success}개\n실패: {failed}개")


def main():
    root = tk.Tk()
    app = HLSConverterApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
