"""Fit the original generated fictional portrait to an MPFB face. No real-person photos."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from scipy.interpolate import RBFInterpolator

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('C:/Users/ghd12/Desktop/블랜더/portrait_model/assets')
meta = json.loads((SOURCE/'base_geometry.json').read_text())
options = vision.FaceLandmarkerOptions(base_options=python.BaseOptions(model_asset_buffer=(SOURCE/'face_landmarker.task').read_bytes()), num_faces=1)
with vision.FaceLandmarker.create_from_options(options) as detector:
    def detect(path):
        result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.array(Image.open(path).convert('RGB'))))
        if not result.face_landmarks: raise RuntimeError(f'Face missing: {path}')
        return np.array([[p.x,p.y,p.z] for p in result.face_landmarks[0]])
    base = detect(SOURCE/'base_face.png')
    target = detect(ROOT/'art-source/seoyeon-face.png')
scale = 1.075
source = np.column_stack(((base[:468,0]-.5)*.36*scale, (meta['camera_center_z']+(.5-base[:468,1])*.36+.0283)*scale))
eye_u = (target[468,0]+target[473,0])/2
eye_v = (target[468,1]+target[473,1])/2
photo_scale = .061/abs(target[468,0]-target[473,0])
eye_z = (meta['camera_center_z']+.01+.0283)*scale
destination = np.column_stack(((target[:468,0]-eye_u)*photo_scale, eye_z+(eye_v-target[:468,1])*photo_scale))
anchors = np.array([[-.12,1.70],[0,1.71],[.12,1.70],[-.13,1.43],[.13,1.43],[-.1,1.37],[0,1.36],[.1,1.37]])
field = RBFInterpolator(np.vstack((source,anchors)), np.vstack((destination,anchors)), smoothing=2e-7, kernel='thin_plate_spline')
verts = np.array(meta['vertices']); verts[:,2]+=.0283; verts*=scale
sel = verts[:,2]>1.36
mapped = field(verts[sel][:,[0,2]])
weight = np.clip((verts[sel,2]-1.36)/.09,0,1)*np.clip((.025-verts[sel,1])/.07,0,1)
verts[sel,0] = verts[sel,0]*(1-weight)+mapped[:,0]*weight
verts[sel,2] = verts[sel,2]*(1-weight)+mapped[:,1]*weight
np.save(ROOT/'art-source/seoyeon-vertices.npy',verts)
(ROOT/'art-source/face-calibration.json').write_text(json.dumps({'eye_u':eye_u,'eye_v':eye_v,'eye_z':eye_z,'photo_scale':photo_scale,'landmarks':target.tolist()},indent=2))
print('Fitted 468 facial landmarks; eyes at',eye_z,'texture scale',photo_scale)
