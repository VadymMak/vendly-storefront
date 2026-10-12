# Auto Split (Object Segmentation)

## Overview

Automatically detect and cut out individual objects from an image. The AI identifies separate objects and creates transparent PNG cutouts for each one. Perfect for preparing product photos for compositing.

## How to use

1. Upload or select an image in Studio
2. Click "Auto Split" (or it's available inside Place Products)
3. The AI analyzes the image and detects objects
4. Each detected object appears as a separate cutout
5. Select the cutouts you want to use

## Credits

Free — no credits required.

## How it works

Auto Split uses SAM2 (Segment Anything Model 2) to detect objects. It:
1. Analyzes the entire image for distinct objects
2. Skips what is usually not a product: tiny specks (under 0.5% of the image), large areas over half of the image (background, table top) and regions touching 3 or more image edges (walls, surfaces)
3. Cuts out each remaining object with slightly softened edges, so cutouts blend in naturally
4. Returns up to 12 cutouts, largest objects first

If a single product fills almost the whole photo, Auto Split still returns it as one cutout.

## Best for

- **Product photos** with multiple items — split them into individual cutouts
- **Group photos** — isolate individual items
- **Preparing for Place Products** — get cutouts ready to compose into scenes

## Limitations

- Maximum 12 cutouts per image
- Very small objects (under 20×20 pixels) are filtered out
- Works best with clear, well-lit images
- Objects that blend into the background may not be detected
