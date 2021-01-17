/*
 * MIT License
 *
 * Copyright (c) 2020 duncan law
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import * as BABYLON from 'babylonjs';
import {BaseMaterial} from "../baseMaterial";

import "./land.fragment";
import "./land.vertex";

export class LandMaterial extends BaseMaterial {
    private readonly NOISE_DETAIL = 20;
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

    protected shaderName: string = "land";

    // Methods
    constructor(name: string, public scale: number, scene: BABYLON.Scene) {
        super(name, scene);
        this.uniforms = this.uniforms.concat([
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
        ]);
        this.samplers = this.samplers.concat([ "drainage" ]);
    }

    public clone(name: string): BaseMaterial {
        return BABYLON.SerializationHelper.Clone<BaseMaterial>(
            () => new LandMaterial(name, this.scale, this.getScene()), this);
    }

    // Statics
    public static Parse(source: any, scene: BABYLON.Scene, rootUrl: string): BaseMaterial {
        return BABYLON.SerializationHelper.Parse(
            () => new LandMaterial(source.name, source.scale, scene), source, scene, rootUrl);
    }

    protected _bindForSubMeshSubclassed(): void {
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
    }

    public getClassName(): string {
        return "LandMaterial";
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
}

BABYLON._TypeStore.RegisteredTypes["BABYLON.LandMaterial"] = LandMaterial;
