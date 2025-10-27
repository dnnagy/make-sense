# YOLO OBB (Oriented Bounding Box) Implementation

## Overview
This document describes the implementation of YOLO Oriented Bounding Box (OBB) support in the make-sense image labeling tool.

## What is YOLO OBB?
YOLO OBB (Oriented Bounding Box) is a format used by Ultralytics YOLO models for annotating rotated objects. Unlike regular axis-aligned bounding boxes, OBBs can be rotated to better fit objects at any angle, making them particularly useful for aerial/satellite imagery and other scenarios where objects are not always upright.

### YOLO OBB Format Specification
According to the Ultralytics documentation, the YOLO OBB format is:
```
class_index x1 y1 x2 y2 x3 y3 x4 y4
```

Where:
- `class_index`: The class ID of the object
- `x1 y1`, `x2 y2`, `x3 y3`, `x4 y4`: Four corner points of the oriented bounding box
- All coordinates are normalized to [0, 1] range (divided by image width/height)

## Implementation Details

### 1. Core Type System
**Files Modified:**
- `src/data/enums/LabelType.ts` - Added `OBB = 'OBB'` to LabelType enum
- `src/store/labels/types.ts` - Added `LabelOBB` type and `labelOBBs` array to `ImageData`

The `LabelOBB` type includes:
```typescript
export type LabelOBB = Annotation & {
    vertices: IPoint[];
    isCreatedByAI: boolean;
    status: LabelStatus;
    suggestedLabel: string;
}
```

### 2. Label Toolkit Integration
**Files Modified:**
- `src/data/info/LabelToolkitData.ts` - Added OBB option to the label toolkit menu

Users can now select "OBB" as a labeling mode alongside Rect, Point, Line, and Polygon.

### 3. Rendering Engine
**Files Created:**
- `src/logic/render/OBBRenderEngine.ts` - Complete rendering engine for drawing and editing OBBs

**Features:**
- Interactive drawing: Users draw OBBs by clicking 3 points:
  1. First point: Start of first edge
  2. Second point: End of first edge (defines one side of the box)
  3. Third point: Defines the width/height by projecting perpendicular to the first edge
- Vertex manipulation: Users can drag any of the 4 corners to reshape the OBB
- Visual feedback: Active and highlighted OBBs show anchors at corners
- Semi-transparent fill for better visibility

**Files Modified:**
- `src/logic/actions/EditorActions.ts` - Integrated OBBRenderEngine into the editor

### 4. Export Functionality
**Files Created:**
- `src/logic/export/OBBLabelsExporter.ts` - Exports OBB annotations in YOLO OBB format

**Export Format:**
- Creates a .zip file containing .txt files (one per image)
- Each line in the .txt file represents one OBB annotation
- Format: `class_index x1 y1 x2 y2 x3 y3 x4 y4`
- All coordinates normalized to [0, 1]

**Files Modified:**
- `src/views/PopupView/ExportLabelsPopup/ExportLabelPopup.tsx` - Added OBB export option
- `src/data/ExportFormatData.ts` - Added YOLO OBB format description

### 5. Label Management
**Files Created:**
- `src/views/EditorView/SideNavigationBar/OBBLabelsList/OBBLabelsList.tsx` - List view for OBB labels
- `src/views/EditorView/SideNavigationBar/OBBLabelsList/OBBLabelsList.scss` - Styles for OBB list

**Files Modified:**
- `src/views/EditorView/SideNavigationBar/LabelsToolkit/LabelsToolkit.tsx` - Added OBB tab and list
- `src/logic/actions/LabelActions.ts` - Added `deleteOBBLabelById()` and OBB support in visibility toggle
- `src/utils/LabelUtil.ts` - Added `createLabelOBB()` method
- `src/utils/ImageDataUtil.ts` - Initialize `labelOBBs: []` in ImageData creation

## How to Use

### Drawing OBBs:
1. Load your images into the tool
2. Create or select label classes
3. Select "OBB" from the label toolkit on the right sidebar
4. Click to place the first corner of your box
5. Click to place the second corner (defines one edge)
6. Click to define the width of the box (the tool auto-completes the rectangle)

### Editing OBBs:
1. Click on an existing OBB to select it
2. Drag any of the 4 corner anchors to reshape the box
3. The OBB remains a quadrilateral but can be freely adjusted

### Exporting:
1. Click "Export Labels" (or use the export action)
2. Select "OBB" as the label type
3. Choose "YOLO" as the export format
4. Download the .zip file containing your annotations

### File Structure:
```
annotations.zip
├── image1.txt
├── image2.txt
└── image3.txt
```

Each .txt file contains lines like:
```
0 0.512 0.345 0.678 0.389 0.634 0.556 0.468 0.512
1 0.234 0.123 0.345 0.234 0.298 0.401 0.187 0.290
```

## Training with Ultralytics YOLO

Once you have your OBB annotations, you can use them to train YOLO models:

```python
from ultralytics import YOLO

# Load a model
model = YOLO('yolo11n-obb.yaml')

# Train the model
results = model.train(data='your_dataset.yaml', epochs=100, imgsz=640)
```

Your dataset.yaml should specify:
```yaml
path: /path/to/dataset
train: images/train
val: images/val

names:
  0: class_name_1
  1: class_name_2
```

## Files Changed Summary

### New Files Created (7):
1. `src/logic/render/OBBRenderEngine.ts`
2. `src/logic/export/OBBLabelsExporter.ts`
3. `src/views/EditorView/SideNavigationBar/OBBLabelsList/OBBLabelsList.tsx`
4. `src/views/EditorView/SideNavigationBar/OBBLabelsList/OBBLabelsList.scss`

### Files Modified (11):
1. `src/data/enums/LabelType.ts`
2. `src/store/labels/types.ts`
3. `src/data/info/LabelToolkitData.ts`
4. `src/utils/LabelUtil.ts`
5. `src/logic/actions/EditorActions.ts`
6. `src/views/PopupView/ExportLabelsPopup/ExportLabelPopup.tsx`
7. `src/data/ExportFormatData.ts`
8. `src/utils/ImageDataUtil.ts`
9. `src/views/EditorView/SideNavigationBar/LabelsToolkit/LabelsToolkit.tsx`
10. `src/logic/actions/LabelActions.ts`

## References
- [Ultralytics OBB Documentation](https://docs.ultralytics.com/datasets/obb/)
- YOLO OBB format uses 4 corner points normalized to [0, 1]
- Internally, YOLO processes in xywhr format (center x, center y, width, height, rotation)
