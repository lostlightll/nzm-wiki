import os
import struct
import argparse
from pathlib import Path

# ================= CONFIG =================
OUTPUT_ROOT = "./output"
PATCH_KB2N_TO_KB2K = True  # 是否把 KB2n 改成 KB2k（有些工具更容易识别）
# =======================================

def find_and_extract_bink(data: bytes):
    """
    在二进制数据中寻找有效的 Bink2 流（KB2n 等）。
    返回: (提取出的数据 bytearray, 是否成功 bool)
    """
    file_size = len(data)

    # 优先检查偏移量 128（针对部分 UE/游戏资源常见布局）
    if len(data) > 128 + 4 and data[128:132] == b'KB2n':
        potential_offsets = [128]
    else:
        # 否则进行全文件扫描
        potential_offsets = []
        start = 0
        while True:
            loc = data.find(b'KB2n', start)
            if loc == -1:
                break
            potential_offsets.append(loc)
            start = loc + 1

    for off in potential_offsets:
        if off + 16 > file_size:
            continue

        try:
            # KB2n header: [Sig:4][Size:4][Frames:4]...
            declared_size = struct.unpack('<I', data[off + 4:off + 8])[0]
            # frames = struct.unpack('<I', data[off + 8:off + 12])[0]  # 目前不需要可注释
        except Exception:
            continue

        if declared_size <= 0:
            continue

        # 校验大小是否越界
        end = off + declared_size
        if end <= file_size:
            return bytearray(data[off:end]), True

    return None, False

def patch_signature(bink_data: bytearray):
    """
    将 KB2n 修改为 KB2k（可选）。
    """
    if bink_data and bink_data[0:4] == b'KB2n':
        bink_data[3] = 0x6B  # 'k'
        return True
    return False

def process_single_file(file_path, root_src_dir=None):
    file_path = Path(file_path)

    # 计算输出路径，保持目录结构
    if root_src_dir:
        rel_path = file_path.relative_to(root_src_dir)
        output_dir = Path(OUTPUT_ROOT) / rel_path.parent
    else:
        output_dir = Path(OUTPUT_ROOT)

    output_dir.mkdir(parents=True, exist_ok=True)

    # 输出文件名
    bk2_out = output_dir / (file_path.stem + ".bk2")

    print(f"正在处理: {file_path} ...", end="", flush=True)

    try:
        raw_data = file_path.read_bytes()
    except Exception as e:
        print(f" [读取失败] {e}")
        return

    # 1. 提取
    clean_data, found = find_and_extract_bink(raw_data)
    if not found or clean_data is None:
        print(" [跳过] 未发现有效的 Bink 视频流")
        return

    # 2. 可选修补 (KB2n -> KB2k)
    patched = False
    if PATCH_KB2N_TO_KB2K:
        patched = patch_signature(clean_data)

    # 3. 写入 BK2
    try:
        bk2_out.write_bytes(clean_data)
        print(f" -> [成功] 输出: {bk2_out}" + (" (已修补头 KB2n->KB2k)" if patched else ""))
    except Exception as e:
        print(f" [写入失败] {e}")

def main():
    parser = argparse.ArgumentParser(description="UE4/游戏资源 .bin 提取 Bink2(.bk2) 工具（不转码）")
    parser.add_argument("inputs", nargs='+', help="输入文件或目录 (例如: video.bin 或 ./movies/)")
    args = parser.parse_args()

    for input_path in args.inputs:
        path_obj = Path(input_path)

        if not path_obj.exists():
            print(f"错误: 路径不存在 {input_path}")
            continue

        if path_obj.is_file():
            if path_obj.suffix.lower() == '.bin':
                process_single_file(path_obj)

        elif path_obj.is_dir():
            print(f"正在扫描目录: {path_obj} ...")
            for root, _, files in os.walk(path_obj):
                for file in files:
                    if file.lower().endswith('.bin'):
                        full_path = Path(root) / file
                        process_single_file(full_path, root_src_dir=path_obj)

    print("-" * 30)
    print(f"所有任务完成。输出目录: {os.path.abspath(OUTPUT_ROOT)}")

if __name__ == "__main__":
    main()
