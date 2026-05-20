#!/bin/bash
set -e
cd "$(dirname "$0")/.."
python generate_synthetic.py --output data/csi/ --samples 200
python preprocess_data.py --input data/csi/ --output data/processed/
python train_cnn.py --epochs 5
python export_onnx.py
