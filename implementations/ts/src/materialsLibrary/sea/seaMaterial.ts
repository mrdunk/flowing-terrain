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

import "./sea.fragment";
import "./sea.vertex";

export class SeaMaterial extends BaseMaterial {
    public time: number = 0;
    protected shaderName: string = "sea";

    // Methods
    constructor(name: string, public size: number, public offset: number, scene: BABYLON.Scene) {
        super(name, scene);
        this.uniforms = this.uniforms.concat([
            "size",    // Circle size to draw before changing to background colour.
            "offset",  // How much the horizon circle is offset from center.
            "time"     // Wave movement.
        ]);
    }

    public clone(name: string): BaseMaterial {
        return BABYLON.SerializationHelper.Clone<BaseMaterial>(
            () => new SeaMaterial(name, this.size, this.offset, this.getScene()), this);
    }

    // Statics
    public static Parse(source: any, scene: BABYLON.Scene, rootUrl: string): BaseMaterial {
        return BABYLON.SerializationHelper.Parse(
            () => new SeaMaterial(source.name, source.size, source.offset, scene),
            source, scene, rootUrl);
    }

    protected _bindForSubMeshSubclassed(): void {
        this._activeEffect.setFloat("size", this.size);
        this._activeEffect.setFloat("offset", this.offset);
        this._activeEffect.setFloat("time", this.time);
    }

    public getClassName(): string {
        return "SeaMaterial";
    }
}

BABYLON._TypeStore.RegisteredTypes["BABYLON.SeaMaterial"] = SeaMaterial;
