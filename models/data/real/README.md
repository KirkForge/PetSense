# Real-World CSI Data Collection

This directory is the target for real-world Channel State Information (CSI) data
collected from ESP32-S3 nodes. It is currently empty — data collection is pending.

## Data Collection Protocol

### Node Placement

1. Deploy 2–3 ESP32-S3 nodes running `firmware/` in the monitoring area.
2. Each node should be at a known (x, y) position, recorded in `config.yaml`
   under `nodes[].position`.
3. Nodes must connect to the same WiFi access point used by the edge hub.
4. Ensure line-of-sight or consistent multipath conditions per node.

### Labeling Procedure

1. Place a single pet (dog or cat) in the monitored area.
2. Record the pet's species, activity, and room for each session.
3. Activities: `walking`, `running`, `lying`, `playing`, `scratching`, `jumping`.
4. Use a timestamped log (pen + paper or phone) to mark activity transitions.
5. Each labeled session should be 5–30 minutes of continuous observation.
6. Include empty-room sessions (no pet present) for negative samples.

### File Format

Each session produces one `.npy` file containing a NumPy array of shape
`(N, 128, 8)`, where:

- `N`: number of CSI windows in the session
- `128`: window size (samples per window)
- `8`: number of PCA components per sample

Alongside the `.npy` files, include a `labels.csv` with columns:

```
session_id,species,activity,room,start_time,end_time,npy_file
```

Example:
```
session_001,dog,walking,living_room,2026-07-23T10:00:00Z,2026-07-23T10:15:00Z,session_001.npy
session_002,cat,jumping,kitchen,2026-07-23T11:00:00Z,2026-07-23T11:05:00Z,session_002.npy
session_003,human,walking,hallway,2026-07-23T12:00:00Z,2026-07-23T12:10:00Z,session_003.npy
```

### Minimum Dataset for Validation

- At least 3 sessions per species (dog, cat, human)
- At least 2 sessions per activity type
- At least 2 empty-room sessions
- Total: ~30 sessions minimum for meaningful per-class metrics

## Data Pipeline

1. ESP32-S3 nodes capture CSI → MQTT → edge-hub
2. `models/preprocess_data.py` converts raw CSI to PCA features
3. `models/validate_real.py` runs the ONNX model on real data and outputs
   per-class precision/recall/F1
4. Results are recorded in `models/MODEL_CARD.md`

## Important Notes

- **Do not commit real CSI data to the repository.** Data files are excluded
  via `.gitignore` (`data/`). This directory contains only this README and the
  validation script.
- All CSI data should be collected with informed consent from household members.
- The ONNX model (`petsense-v0.onnx`) was trained on synthetic data only —
  real-world performance may differ significantly from synthetic metrics.