from __future__ import annotations

import argparse
import logging
import os
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch

from train_cnn import PetSenseCNN

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

INPUT_SHAPE = (1, 128, 8)


def load_trained_model(checkpoint_path: str) -> PetSenseCNN:
    model = PetSenseCNN()
    ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    model.load_state_dict(ckpt["model_state"])
    model.eval()
    log.info("Loaded checkpoint: %s (epoch=%d)", checkpoint_path, ckpt.get("epoch", -1))
    return model


def export_onnx(model: PetSenseCNN, out_path: str, opset: int = 17, dtype: str = "fp32") -> None:
    dummy = torch.randn(*INPUT_SHAPE)
    if dtype == "fp16":
        model, dummy = model.half(), dummy.half()
    torch.onnx.export(model, dummy, out_path,
                      input_names=["input"],
                      output_names=["presence", "species", "activity"],
                      dynamic_axes={"input": {0: "batch"}, "presence": {0: "batch"},
                                    "species": {0: "batch"}, "activity": {0: "batch"}},
                      opset_version=opset)
    log.info("ONNX exported -> %s (%.1f KB)", out_path, os.path.getsize(out_path) / 1024)


def quantize_int8(model_path: str, out_path: str) -> None:
    from onnxruntime.quantization import quantize_dynamic, QuantType
    quantize_dynamic(model_input=model_path, model_output=out_path, weight_type=QuantType.QInt8)
    log.info("INT8 quantized -> %s (%.1f KB)", out_path, os.path.getsize(out_path) / 1024)


def verify_export(onnx_path: str, model: PetSenseCNN, tol: float = 1e-4) -> bool:
    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)
    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    sample = torch.randn(2, 128, 8)
    with torch.no_grad():
        p_torch, s_torch, a_torch = model(sample)
    onnx_outputs = session.run(None, {"input": sample.numpy().astype(np.float32)})
    ok = True
    for name, t_out, o_out in [("presence", p_torch, torch.tensor(onnx_outputs[0])),
                                ("species", s_torch, torch.tensor(onnx_outputs[1])),
                                ("activity", a_torch, torch.tensor(onnx_outputs[2]))]:
        max_diff = (t_out - o_out).abs().max().item()
        log.info("verify %s: max_diff=%.6f %s", name, max_diff, "PASS" if max_diff < tol else "FAIL")
        if max_diff >= tol:
            ok = False
    return ok


def main() -> None:
    ap = argparse.ArgumentParser(description="Export PetSense model to ONNX")
    ap.add_argument("--checkpoint", default="models/checkpoints/petsense-final.pt")
    ap.add_argument("--output", default="models")
    ap.add_argument("--opset", type=int, default=17)
    ap.add_argument("--skip-verify", action="store_true")
    args = ap.parse_args()

    model = load_trained_model(args.checkpoint)
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    fp32_path = str(out_dir / "petsense-v0.onnx")
    export_onnx(model, fp32_path, opset=args.opset)
    export_onnx(load_trained_model(args.checkpoint).half(), str(out_dir / "petsense-v0-fp16.onnx"),
                opset=args.opset, dtype="fp16")
    quantize_int8(fp32_path, str(out_dir / "petsense-v0-int8.onnx"))
    if not args.skip_verify:
        verify_export(fp32_path, model)
    log.info("All exports complete in %s", out_dir)


if __name__ == "__main__":
    main()
