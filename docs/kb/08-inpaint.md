# Edit & Replace (Inpaint)

## Overview

Paint over any area of an image to change or remove objects. The AI fills the painted area with new content that blends seamlessly with the rest of the image.

## How to use

1. Upload or select an image in Studio
2. Click "Edit & Replace" in Quick Tools
3. Paint over the area you want to change (use the brush tool)
4. Optionally write what should replace it (e.g., "a green plant")
5. Click Generate

## Credits

2 image credits per inpaint operation.

## Two modes

### Object Removal
Leave the prompt empty. The AI fills the painted area with a clean, natural background that matches the surroundings. Great for removing unwanted objects, people, or text from photos.

### Object Replacement
Write a description of what should appear in the painted area. For example, paint over a vase and write "a bouquet of red roses" — the AI replaces the vase with roses.

## Tips

- Paint generously — cover the entire object plus a small margin
- The larger the painted area, the more creative freedom the AI has
- For removal, the AI works best when the surrounding context is clear
- For replacement, be specific about what you want

## Technical Details

- Uses Flux Fill Pro model on Replicate
- Guidance parameter: 2-5 (controlled automatically)
- Default prompt for removal: "clean natural background, seamless fill"
