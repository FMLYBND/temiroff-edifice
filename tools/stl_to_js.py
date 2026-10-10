"""STL здания (мм, Z вверх) -> assets/model-stl.js (для file://) и assets/stl/bc_navoi.glb.
Перевод в систему model.html: x = 7.5 - X/1000, y = Z/1000, z = Y/1000 - 10.1 (метры, Y вверх).
Это поворот на 180° вокруг вертикали после Z-up -> Y-up (без зеркала): консоли STL (+X, +Y)
ложатся на фасад 2 (x=0) и фасад 1 (z=0); пятно 1 этажа 12,4 x 15,0 совпадает с x 1.3..13.7, z -16.3..-1.3.
Запуск: python tools/stl_to_js.py assets/stl/bc_navoi.stl"""
import sys, base64, json, numpy as np, trimesh
src = sys.argv[1] if len(sys.argv) > 1 else 'assets/stl/bc_navoi.stl'
m = trimesh.load(src, process=True)          # process=True склеивает совпадающие вершины
m.merge_vertices()
X, Y, Z = m.vertices.T / 1000.0
v = np.stack([7.5 - X, Z, Y - 10.1], axis=1).astype(np.float32)
f = m.faces.astype(np.uint16)
# поворот без зеркала -> обход треугольников сохраняется
mm = trimesh.Trimesh(v, f, process=False)
mm.export('assets/stl/bc_navoi.glb')
b = lambda a: base64.b64encode(a.tobytes()).decode()
meta = dict(source='bc_navoi.stl', tris=int(len(f)), verts=int(len(v)),
            transform='x=7.5-X/1000, y=Z/1000, z=Y/1000-10.1',
            bounds=[[round(float(x), 3) for x in v.min(0)], [round(float(x), 3) for x in v.max(0)]])
with open('assets/model-stl.js', 'w') as o:
    o.write('/* Фактическая модель БЦ из STL (сгенерировано tools/stl_to_js.py, руками не править).\n   ' + meta['transform'] + ' */\n')
    o.write('window.EDIFICE_STL = ' + json.dumps(dict(meta, pos=b(v), idx=b(f))) + ';\n')
print(meta)
