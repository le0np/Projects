/**
 * Builds a tiny skinned glTF (two bones, one box) plus a separate animation-only file,
 * mimicking what the Tripo rig + retarget steps produce. Used to test the asset pipeline offline.
 */
import { Document, NodeIO } from '@gltf-transform/core';

function skeleton(doc: Document) {
  const root = doc.createNode('Armature');
  const hips = doc.createNode('Hips').setTranslation([0, 1, 0]);
  const spine = doc.createNode('Spine').setTranslation([0, 0.5, 0]);
  root.addChild(hips);
  hips.addChild(spine);
  return { root, hips, spine };
}

function rotationClip(doc: Document, name: string, target: ReturnType<typeof skeleton>['spine'], angle: number) {
  const buf = doc.getRoot().listBuffers()[0];
  const times = doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 0.5, 1])).setBuffer(buf);
  const s = Math.sin(angle / 2);
  const c = Math.cos(angle / 2);
  const values = doc.createAccessor().setType('VEC4').setArray(new Float32Array([0, 0, 0, 1, s, 0, 0, c, 0, 0, 0, 1])).setBuffer(buf);
  const sampler = doc.createAnimationSampler().setInput(times).setOutput(values).setInterpolation('LINEAR');
  const channel = doc.createAnimationChannel().setTargetNode(target).setTargetPath('rotation').setSampler(sampler);
  doc.createAnimation(name).addSampler(sampler).addChannel(channel);
}

export async function writeFixture(dir: string): Promise<void> {
  const io = new NodeIO();

  // Rigged model (mesh + skin), like Tripo's rig output.
  const doc = new Document();
  const buf = doc.createBuffer();
  const sk = skeleton(doc);
  const positions = new Float32Array([
    -0.3, 0, -0.2, 0.3, 0, -0.2, 0.3, 0, 0.2, -0.3, 0, 0.2,
    -0.3, 1.8, -0.2, 0.3, 1.8, -0.2, 0.3, 1.8, 0.2, -0.3, 1.8, 0.2,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0]);
  const joints = new Uint16Array(8 * 4);
  const weights = new Float32Array(8 * 4);
  for (let i = 0; i < 8; i++) {
    joints[i * 4] = i < 4 ? 0 : 1;
    weights[i * 4] = 1;
  }
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buf))
    .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(joints).setBuffer(buf))
    .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(weights).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buf))
    .setMaterial(doc.createMaterial('body').setBaseColorFactor([0.8, 0.7, 0.6, 1]));
  const ibm = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1.5, 0, 1,
  ]);
  const skin = doc
    .createSkin()
    .addJoint(sk.hips)
    .addJoint(sk.spine)
    .setSkeleton(sk.hips)
    .setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buf));
  const meshNode = doc.createNode('Body').setMesh(doc.createMesh('Body').addPrimitive(prim)).setSkin(skin);
  sk.root.addChild(meshNode);
  doc.createScene('Scene').addChild(sk.root);
  await io.write(`${dir}/rigged.glb`, doc);

  // Animation-only file, like retarget with export_with_geometry=false. Clip names carry the preset names.
  const adoc = new Document();
  adoc.createBuffer();
  const ask = skeleton(adoc);
  adoc.createScene('Scene').addChild(ask.root);
  rotationClip(adoc, 'Armature|preset_biped_idle', ask.spine, 0.1);
  rotationClip(adoc, 'Armature|preset_biped_walk', ask.spine, 0.4);
  rotationClip(adoc, 'Armature|preset_biped_run', ask.spine, 0.8);
  await io.write(`${dir}/anims_test.glb`, adoc);
}
