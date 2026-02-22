"""
MongoDB collection names — Sine v2.

Collections:
  - videos        : one document per recording session
  - annotations   : timestamped comments tied to a video
  - scene_markers : context-aware markers captured during recording
"""

VIDEOS_COLLECTION = "videos"
ANNOTATIONS_COLLECTION = "annotations"
SCENE_MARKERS_COLLECTION = "scene_markers"
