/*
 * This file uses Babylon.js/materialsLibrary/src/simple/ as a template.
 * */

import * as BABYLON from 'babylonjs';

import "./land.fragment";
import "./land.vertex";

class LandMaterialDefines extends BABYLON.MaterialDefines {
    public DIFFUSE = false;
    public CLIPPLANE = false;
    public CLIPPLANE2 = false;
    public CLIPPLANE3 = false;
    public CLIPPLANE4 = false;
    public CLIPPLANE5 = false;
    public CLIPPLANE6 = false;
    public ALPHATEST = false;
    public DEPTHPREPASS = false;
    public POINTSIZE = false;
    public FOG = false;
    public NORMAL = false;
    public UV1 = false;
    public UV2 = false;
    public VERTEXCOLOR = false;
    public VERTEXALPHA = false;
    public NUM_BONE_INFLUENCERS = 0;
    public BonesPerMesh = 0;
    public INSTANCES = false;
    public IMAGEPROCESSINGPOSTPROCESS = false;

    constructor() {
        super();
        this.rebuild();
    }
}

export class LandMaterial extends BABYLON.PushMaterial {
    private readonly NOISE_DETAIL = 20;
    @BABYLON.serializeAsTexture("diffuseTexture")
    private _diffuseTexture: BABYLON.BaseTexture;
    @BABYLON.expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public diffuseTexture: BABYLON.BaseTexture;

    @BABYLON.serializeAsColor3("diffuse")
    public diffuseColor = new BABYLON.Color3(1, 1, 1);

    @BABYLON.serialize("disableLighting")
    private _disableLighting = false;
    @BABYLON.expandToProperty("_markAllSubMeshesAsLightsDirty")
    public disableLighting: boolean;

    @BABYLON.serialize("maxSimultaneousLights")
    private _maxSimultaneousLights = 4;
    @BABYLON.expandToProperty("_markAllSubMeshesAsLightsDirty")
    public maxSimultaneousLights: number;

    private _noiseCoeficientLowToSend: Float32Array;
    private _noiseCoeficientMidToSend: Float32Array;
    private _noiseCoeficientHighToSend: Float32Array;
    private _noiseWeightLow: number;
    private _noiseWeightMid: number;
    private _noiseWeightHigh: number;
    public shoreline: number = 0.05;
    public sealevel: number = 0.5;
    public snowline: number = 10.0;
    public rockLikelihood: number = 1.0;
    public riverWidth: number = 20.0;
    public riverLikelihood: number = 25.0;
    public drainage: BABYLON.RawTexture;

    constructor(name: string, public scale: number, scene: BABYLON.Scene) {
        super(name, scene);
    }

    public needAlphaBlending(): boolean {
        return (this.alpha < 1.0);
    }

    public needAlphaTesting(): boolean {
        return false;
    }

    public getAlphaTestTexture(): BABYLON.Nullable<BABYLON.BaseTexture> {
        return null;
    }

    // Methods
    public isReadyForSubMesh(
        mesh: BABYLON.AbstractMesh,
        subMesh: BABYLON.SubMesh,
        useInstances?: boolean
    ): boolean {
        if (this.isFrozen) {
            if (subMesh.effect && subMesh.effect._wasPreviouslyReady) {
                return true;
            }
        }

        if (!subMesh._materialDefines) {
            subMesh._materialDefines = new LandMaterialDefines();
        }

        var defines = <LandMaterialDefines>subMesh._materialDefines;
        var scene = this.getScene();

        if (this._isReadyForSubMesh(subMesh)) {
            return true;
        }

        var engine = scene.getEngine();

        // Textures
        if (defines._areTexturesDirty) {
            defines._needUVs = false;
            if (scene.texturesEnabled) {
                if (this._diffuseTexture && BABYLON.MaterialFlags.DiffuseTextureEnabled) {
                    if (!this._diffuseTexture.isReady()) {
                        return false;
                    } else {
                        defines._needUVs = true;
                        defines.DIFFUSE = true;
                    }
                }
            }
        }

        // Misc.
        BABYLON.MaterialHelper.PrepareDefinesForMisc(
            mesh,
            scene,
            false,
            this.pointsCloud,
            this.fogEnabled,
            this._shouldTurnAlphaTestOn(mesh),
            defines);

        // Lights
        defines._needNormals = BABYLON.MaterialHelper.PrepareDefinesForLights(
            scene, mesh, defines, false, this._maxSimultaneousLights, this._disableLighting);

        // Values that need to be evaluated on every frame
        BABYLON.MaterialHelper.PrepareDefinesForFrameBoundValues(
            scene, engine, defines, useInstances ? true : false);

        // Attribs
        BABYLON.MaterialHelper.PrepareDefinesForAttributes(mesh, defines, true, true);

        // Get correct effect
        if (defines.isDirty) {
            defines.markAsProcessed();
            scene.resetCachedMaterial();

            // Fallbacks
            var fallbacks = new BABYLON.EffectFallbacks();
            if (defines.FOG) {
                fallbacks.addFallback(1, "FOG");
            }

            BABYLON.MaterialHelper.HandleFallbacksForShadows(
                defines, fallbacks, this.maxSimultaneousLights);

            if (defines.NUM_BONE_INFLUENCERS > 0) {
                fallbacks.addCPUSkinningFallback(0, mesh);
            }

            defines.IMAGEPROCESSINGPOSTPROCESS =
                scene.imageProcessingConfiguration.applyByPostProcess;

            //Attributes
            var attribs = [BABYLON.VertexBuffer.PositionKind];

            if (defines.NORMAL) {
                attribs.push(BABYLON.VertexBuffer.NormalKind);
            }

            if (defines.UV1) {
                attribs.push(BABYLON.VertexBuffer.UVKind);
            }

            if (defines.UV2) {
                attribs.push(BABYLON.VertexBuffer.UV2Kind);
            }

            if (defines.VERTEXCOLOR) {
                attribs.push(BABYLON.VertexBuffer.ColorKind);
            }

            BABYLON.MaterialHelper.PrepareAttributesForBones(attribs, mesh, defines, fallbacks);
            BABYLON.MaterialHelper.PrepareAttributesForInstances(attribs, defines);

            var shaderName = "land";
            var join = defines.toString();
            var uniforms = [
                "world",
                "view",
                "viewProjection",
                "vEyePosition",
                "vLightsType",
                "vDiffuseColor",
                "vFogInfos",
                "vFogColor",
                "pointSize",
                "vDiffuseInfos",
                "mBones",
                "vClipPlane",
                "vClipPlane2",
                "vClipPlane3",
                "vClipPlane4",
                "vClipPlane5",
                "vClipPlane6",
                "diffuseMatrix",
                "noiseCoeficientLow",
                "noiseCoeficientMid",
                "noiseCoeficientHigh",
                "noiseWeightLow",
                "noiseWeightMid",
                "noiseWeightHigh",
                "shoreline",
                "sealevel",
                "snowline",
                "rockLikelihood",
                "riverWidth",
                "riverLikelihood",
                "scale"
            ];
            var samplers = [
                "diffuseSampler",
                "drainage"
            ];
            var uniformBuffers = new Array<string>();

            BABYLON.MaterialHelper.PrepareUniformsAndSamplersList(
                <BABYLON.IEffectCreationOptions>{
                    uniformsNames: uniforms,
                    uniformBuffersNames: uniformBuffers,
                    samplers: samplers,
                    defines: defines,
                    maxSimultaneousLights: this.maxSimultaneousLights
                });
            subMesh.setEffect(scene.getEngine().createEffect(shaderName,
                <BABYLON.IEffectCreationOptions>{
                    attributes: attribs,
                    uniformsNames: uniforms,
                    uniformBuffersNames: uniformBuffers,
                    samplers: samplers,
                    defines: join,
                    fallbacks: fallbacks,
                    onCompiled: this.onCompiled,
                    onError: this.onError,
                    indexParameters: { maxSimultaneousLights: this._maxSimultaneousLights - 1 }
                }, engine), defines);

        }
        if (!subMesh.effect || !subMesh.effect.isReady()) {
            return false;
        }

        defines._renderId = scene.getRenderId();
        subMesh.effect._wasPreviouslyReady = true;

        return true;
    }

    public bindForSubMesh(
        world: BABYLON.Matrix, mesh: BABYLON.Mesh, subMesh: BABYLON.SubMesh
    ): void {
        var scene = this.getScene();

        var defines = <LandMaterialDefines>subMesh._materialDefines;
        if (!defines) {
            return;
        }

        var effect = subMesh.effect;
        if (!effect) {
            return;
        }
        this._activeEffect = effect;

        // Matrices
        this.bindOnlyWorldMatrix(world);
        this._activeEffect.setMatrix("viewProjection", scene.getTransformMatrix());

        // Bones
        BABYLON.MaterialHelper.BindBonesParameters(mesh, this._activeEffect);

        if (this._mustRebind(scene, effect)) {
            // Textures
            if (this._diffuseTexture && BABYLON.MaterialFlags.DiffuseTextureEnabled) {
                this._activeEffect.setTexture("diffuseSampler", this._diffuseTexture);

                this._activeEffect.setFloat2(
                    "vDiffuseInfos",
                    this._diffuseTexture.coordinatesIndex,
                    this._diffuseTexture.level);
                this._activeEffect.setMatrix(
                    "diffuseMatrix",
                    this._diffuseTexture.getTextureMatrix());
            }

            // Clip plane
            BABYLON.MaterialHelper.BindClipPlane(this._activeEffect, scene);

            // Point size
            if (this.pointsCloud) {
                this._activeEffect.setFloat("pointSize", this.pointSize);
            }

            BABYLON.MaterialHelper.BindEyePosition(effect, scene);
        }

        this._activeEffect.setColor4(
            "vDiffuseColor", this.diffuseColor, this.alpha * mesh.visibility);

        // Lights
        if (scene.lightsEnabled && !this.disableLighting) {
            BABYLON.MaterialHelper.BindLights(
                scene, mesh, this._activeEffect, defines, this.maxSimultaneousLights);
        }

        // View
        if (scene.fogEnabled && mesh.applyFog && scene.fogMode !== BABYLON.Scene.FOGMODE_NONE) {
            this._activeEffect.setMatrix("view", scene.getViewMatrix());
        }

        // Fog
        BABYLON.MaterialHelper.BindFogParameters(scene, mesh, this._activeEffect);

        // Define terrain noise.
        this._activeEffect.setFloatArray("noiseCoeficientLow", this._noiseCoeficientLowToSend);
        this._activeEffect.setFloatArray("noiseCoeficientMid", this._noiseCoeficientMidToSend);
        this._activeEffect.setFloatArray("noiseCoeficientHigh", this._noiseCoeficientHighToSend);
        this._activeEffect.setFloat("noiseWeightLow", this._noiseWeightLow);
        this._activeEffect.setFloat("noiseWeightMid", this._noiseWeightMid);
        this._activeEffect.setFloat("noiseWeightHigh", this._noiseWeightHigh);
        this._activeEffect.setFloat("scale", this.scale);
        this._activeEffect.setFloat("shoreline", this.shoreline);
        this._activeEffect.setFloat("sealevel", this.sealevel);
        this._activeEffect.setFloat("snowline", this.snowline);
        this._activeEffect.setFloat("rockLikelihood", this.rockLikelihood);
        this._activeEffect.setFloat("riverWidth", this.riverWidth);
        this._activeEffect.setFloat("riverLikelihood", this.riverLikelihood);
        this._activeEffect.setTexture("drainage", this.drainage);

        this._afterBind(mesh, this._activeEffect);
    }

    public getAnimatables(): BABYLON.IAnimatable[] {
        var results = [];

        if (this._diffuseTexture &&
            this._diffuseTexture.animations &&
            this._diffuseTexture.animations.length > 0
        ) {
            results.push(this._diffuseTexture);
        }

        return results;
    }

    public getActiveTextures(): BABYLON.BaseTexture[] {
        var activeTextures = super.getActiveTextures();

        if (this._diffuseTexture) {
            activeTextures.push(this._diffuseTexture);
        }

        return activeTextures;
    }

    public hasTexture(texture: BABYLON.BaseTexture): boolean {
        if (super.hasTexture(texture)) {
            return true;
        }

        if (this.diffuseTexture === texture) {
            return true;
        }

        return false;
    }

    public dispose(forceDisposeEffect?: boolean): void {
        if (this._diffuseTexture) {
            this._diffuseTexture.dispose();
        }

        super.dispose(forceDisposeEffect);
    }

    public clone(name: string): LandMaterial {
        return BABYLON.SerializationHelper.Clone<LandMaterial>(
            () => new LandMaterial(name, this.scale, this.getScene()), this);
    }

    public serialize(): any {
        var serializationObject = BABYLON.SerializationHelper.Serialize(this);
        serializationObject.customType = "BABYLON.LandMaterial";
        return serializationObject;
    }

    public getClassName(): string {
        return "LandMaterial";
    }

    public setShoreline(height: number): void {
        this.shoreline = height;
    }

    public setSealevel(height: number): void {
        this.sealevel = height;
    }

    public setSnowline(height: number): void {
        this.snowline = height;
    }

    public setRockLikelihood(value: number): void {
        this.rockLikelihood = value;
    }

    public setRiverWidth(value: number): void {
        this.riverWidth = value;
    }

    public setRiverLikelihood(value: number): void {
        this.riverLikelihood = value;
    }

    public setDrainage(data: BABYLON.RawTexture): void {
        this.drainage = data;
    }

    public setNoise(
        noiseCoeficientLow: [number, number][],
        noiseCoeficientMid: [number, number][],
        noiseCoeficientHigh: [number, number][],
        noiseWeightLow: number,
        noiseWeightMid: number,
        noiseWeightHigh: number
    ): void {
        // Ignore any out of range values.
        noiseCoeficientLow = noiseCoeficientLow.slice(0, this.NOISE_DETAIL);
        noiseCoeficientMid = noiseCoeficientMid.slice(0, this.NOISE_DETAIL);
        noiseCoeficientHigh = noiseCoeficientHigh.slice(0, this.NOISE_DETAIL);

        const noiseCoeficientLowToSend: number[] = [];
        const noiseCoeficientMidToSend: number[] = [];
        const noiseCoeficientHighToSend: number[] = [];
        for (let i=0; i < this.NOISE_DETAIL; i++) {
            if (i < noiseCoeficientLow.length) {
                noiseCoeficientLowToSend.push(noiseCoeficientLow[i][0]);
                noiseCoeficientLowToSend.push(noiseCoeficientLow[i][1]);
            } else {
                noiseCoeficientLowToSend.push(0);
                noiseCoeficientLowToSend.push(0);
            }
            if (i < noiseCoeficientMid.length) {
                noiseCoeficientMidToSend.push(noiseCoeficientMid[i][0]);
                noiseCoeficientMidToSend.push(noiseCoeficientMid[i][1]);
            } else {
                noiseCoeficientMidToSend.push(0);
                noiseCoeficientMidToSend.push(0);
            }
            if (i < noiseCoeficientHigh.length) {
                noiseCoeficientHighToSend.push(noiseCoeficientHigh[i][0]);
                noiseCoeficientHighToSend.push(noiseCoeficientHigh[i][1]);
            } else {
                noiseCoeficientHighToSend.push(0);
                noiseCoeficientHighToSend.push(0);
            }
        }
        this._noiseCoeficientLowToSend = new Float32Array(noiseCoeficientLowToSend);
        this._noiseCoeficientMidToSend = new Float32Array(noiseCoeficientMidToSend);
        this._noiseCoeficientHighToSend = new Float32Array(noiseCoeficientHighToSend);
        this._noiseWeightLow = noiseWeightLow;
        this._noiseWeightMid = noiseWeightMid;
        this._noiseWeightHigh = noiseWeightHigh;
    }

    // Statics
    public static Parse(source: any, scene: BABYLON.Scene, rootUrl: string): LandMaterial {
        return BABYLON.SerializationHelper.Parse(
            () => new LandMaterial(source.name, source.scale, scene), source, scene, rootUrl);
    }
}

BABYLON._TypeStore.RegisteredTypes["BABYLON.LandMaterial"] = LandMaterial;
