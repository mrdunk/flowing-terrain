import * as BABYLON from 'babylonjs';
import { BaseCameraPointersInput } from './BaseCameraPointersInput';

enum _CameraProperty {
    /**
     * Move camera relative to it's current orientation.
     */
    MoveRelative,
    /**
     * Rotate camera relative to it's current orientation.
     */
    RotateRelative,
    /**
     * Move camera relative to the current scene.
     */
    MoveScene,
    /**
     * Move camera relative to the camera's heading and the scene's height.
     */
    MoveOverScene
}

enum _PointerInputTypes {
    ButtonDown,
    ButtonUp,
    DoubleTap,
    Touch,
    MultiTouch,
    Pinch
}

enum _Modifiers {
    ShiftDown = Math.pow(2, 0),
    ShiftUp = Math.pow(2, 1),
    AltDown = Math.pow(2, 2),
    AltUp = Math.pow(2, 3),
    CtrlDown = Math.pow(2, 4),
    CtrlUp = Math.pow(2, 5),
    MetaDown = Math.pow(2, 6),
    MetaUp = Math.pow(2, 7),
    MouseButton1Down = Math.pow(2, 8),
    MouseButton1Up = Math.pow(2, 9),
    MouseButton2Down = Math.pow(2, 10),
    MouseButton2Up = Math.pow(2, 11),
    MouseButton3Down = Math.pow(2, 12),
    MouseButton3Up = Math.pow(2, 13),
    XAxis = Math.pow(2, 14),
    YAxis = Math.pow(2, 15),
    ZAxis = Math.pow(2, 16)
}

// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
enum _MouseButtons {
    Button1 = 1,
    Button2 = 2,
    Button3 = 4
}

/**
 * Manage the pointers inputs to control a free camera.
 * @see https://doc.babylonjs.com/how_to/customizing_camera_inputs
 */
export class FreeCameraPointersInput extends BaseCameraPointersInput {
    /**
     * Instantiates a new FreeCameraPointersInput.
     */
    constructor() {
        super();
        // Mouse moves camera over scene.
        this._mapPointerToCamera(_PointerInputTypes.Touch,
            _Modifiers.XAxis | _Modifiers.ShiftUp | _Modifiers.MouseButton2Up,
            _CameraProperty.MoveOverScene,
            BABYLON.Coordinate.X);
        this._mapPointerToCamera(_PointerInputTypes.Touch,
            _Modifiers.YAxis | _Modifiers.ShiftUp | _Modifiers.MouseButton2Up,
            _CameraProperty.MoveOverScene,
            BABYLON.Coordinate.Z);
        // Mouse with shift down changes camera orientation.
        this._mapPointerToCamera(_PointerInputTypes.Touch,
            _Modifiers.XAxis | _Modifiers.ShiftDown | _Modifiers.MouseButton2Up,
            _CameraProperty.RotateRelative,
            BABYLON.Coordinate.Y);
        this._mapPointerToCamera(_PointerInputTypes.Touch,
            _Modifiers.YAxis | _Modifiers.ShiftDown | _Modifiers.MouseButton2Up,
            _CameraProperty.RotateRelative,
            BABYLON.Coordinate.X);
        // 2nd mouse button changes camera orientation.
        this._mapPointerToCamera(_PointerInputTypes.Touch,
            _Modifiers.XAxis | _Modifiers.MouseButton2Down,
            _CameraProperty.RotateRelative,
            BABYLON.Coordinate.Y);
        this._mapPointerToCamera(_PointerInputTypes.Touch,
            _Modifiers.YAxis | _Modifiers.MouseButton2Down,
            _CameraProperty.RotateRelative,
            BABYLON.Coordinate.X);

        // MultiTouch drag affects camera orientation.
        this._mapPointerToCamera(_PointerInputTypes.MultiTouch,
            _Modifiers.XAxis,
            _CameraProperty.RotateRelative,
            BABYLON.Coordinate.Y);
        this._mapPointerToCamera(_PointerInputTypes.MultiTouch,
            _Modifiers.YAxis,
            _CameraProperty.RotateRelative,
            BABYLON.Coordinate.X);
        // MultiTouch pinch affects camera height.
        this._mapPointerToCamera(_PointerInputTypes.Pinch,
            _Modifiers.YAxis,
            _CameraProperty.MoveScene,
            BABYLON.Coordinate.Y);
    }

    /**
     * Defines the camera the input is attached to.
     */
    public camera: BABYLON.FreeCamera;

    /**
     * Gets the class name of the current input.
     * @returns the class name
     */
    public getClassName(): string {
        return "FreeCameraPointersInput";
    }

    /**
     * Defines the pointer angular sensitivity when configured to rotate the
     * camera.
     */
    //@serialize()
    public angularSensitivity = new BABYLON.Vector3(0.002, 0.002, 0.002);

    /**
     * Defines the pointer panning sensitivity when configured to pan the
     * camera.
     */
    //@serialize()
    public panSensitivity = new BABYLON.Vector3(0.002, -0.002, 0.002);

    /**
     * Observable for when a pointer move event occurs containing the move delta
     */
    public onPointerMovedObservable = new BABYLON.Observable<{ deltaX: number; deltaY: number }>();

    public checkInputs(): void {
        // Call onTouch(), onButtonUp(), etc.
        //super.checkInputs();

        const cameraTransformMatrix = BABYLON.Matrix.Zero();
        const transformedDirection = BABYLON.Vector3.Zero();

        // For this._moveRelative,
        // convert updates relative to camera to world position
        // an apply to camera.
        this.camera.getViewMatrix().invertToRef(cameraTransformMatrix);
        BABYLON.Vector3.TransformNormalToRef(
            this._moveRelative.multiplyInPlace(this.panSensitivity),
            cameraTransformMatrix,
            transformedDirection);
        this.camera.cameraDirection.addInPlace(transformedDirection);

        // For this._moveOverScene,
        // Point camera at horizon,
        const tempCamX = this.camera.rotation.x;
        this.camera.rotation.x = 0;

        this.camera.getViewMatrix().invertToRef(cameraTransformMatrix);
        BABYLON.Vector3.TransformNormalToRef(
            this._moveOverScene.multiplyInPlace(this.panSensitivity),
            cameraTransformMatrix,
            transformedDirection);
        this.camera.cameraDirection.addInPlace(transformedDirection);

        this.camera.rotation.x = tempCamX;

        // For this._rotateRelative,
        // apply updates to camera orientation.
        if(this._rotateRelative.x !== 0 || this._rotateRelative.y !== 0) {
            this.camera.cameraRotation.x = this._rotateRelative.x * this.angularSensitivity.x;
            this.camera.cameraRotation.y = this._rotateRelative.y * this.angularSensitivity.y;
        }

        // For this._moveRelative, apply to camera.
        this.camera.cameraDirection.addInPlace(
            this._moveScene.multiplyInPlace(this.panSensitivity));

        // Clear any offsets we have just applied.
        this._moveRelative.setAll(0);
        this._rotateRelative.setAll(0);
        this._moveScene.setAll(0);
        this._moveOverScene.setAll(0);
    }

    /**
     * Called on pointer POINTERMOVE event if only a single touch is active.
     */
    protected onTouch(point: BABYLON.Nullable<BABYLON.PointerTouch>,
                      deltaX: number, deltaY: number): void {
        if (! this._pointerToCamera.has(_PointerInputTypes.Touch)) {
            return;
        }
        if (Math.abs(deltaX) > 1000 || Math.abs(deltaY) > 1000) {
            // Cursor dragged off page.
            return;
        }
        this._deltaX = deltaX;
        this._deltaY = deltaY;
        this._applyEvents(_PointerInputTypes.Touch);
    }

    /**
     * Called on pointer POINTERMOVE event if multiple touches are active.
     */
    protected onMultiTouch(pointA: BABYLON.Nullable<BABYLON.PointerTouch>,
                           pointB: BABYLON.Nullable<BABYLON.PointerTouch>,
                           previousPinchSquaredDistance: number,
                           pinchSquaredDistance: number,
                           previousMultiTouchPanPosition: BABYLON.Nullable<BABYLON.PointerTouch>,
                           multiTouchPanPosition: BABYLON.Nullable<BABYLON.PointerTouch>): void {
        // Apply multi-touch pinch events.
        if (this._pointerToCamera.has(_PointerInputTypes.Pinch)) {
            if (previousPinchSquaredDistance && pinchSquaredDistance) {
                this._deltaY = this._deltaX =
                    Math.sqrt(pinchSquaredDistance) - Math.sqrt(previousPinchSquaredDistance);
                this._applyEvents(_PointerInputTypes.Pinch);
            }
        }

        // Apply multi-touch drag events.
        if (this._pointerToCamera.has(_PointerInputTypes.MultiTouch)) {
            if(previousMultiTouchPanPosition !== null && multiTouchPanPosition !== null) {
                this._deltaX = previousMultiTouchPanPosition.x - multiTouchPanPosition.x;
                this._deltaY = previousMultiTouchPanPosition.y - multiTouchPanPosition.y;
                this._applyEvents(_PointerInputTypes.MultiTouch);
            } else {
                this._deltaX = 0;
                this._deltaY = 0;
            }
        }
    }

    private _applyEvents(inputType: _PointerInputTypes): void {
        const touchInputs = this._pointerToCamera.get(inputType);
        touchInputs.forEach(this._updateCameraPropertyWrapper.bind(this));
    }

    private _updateCameraPropertyWrapper(
        value: [_CameraProperty, BABYLON.Coordinate], modifiers: number): void {
            if (this._modifiersMatch(modifiers)) {
                if (modifiers & _Modifiers.XAxis) {
                    this._updateCameraProperty(this._deltaX, value[0], value[1]);
                }
                if (modifiers & _Modifiers.YAxis) {
                    this._updateCameraProperty(this._deltaY, value[0], value[1]);
                }
            }
        }

    private _updateCameraProperty(/* Amount to change camera. */
                                  delta: number,
                                  /* Camera property to be changed. */
                                  cameraProperty: BABYLON.Nullable<_CameraProperty>,
                                  /* Axis of Camera property to be changed. */
                                  coordinate: BABYLON.Nullable<BABYLON.Coordinate>): void {
        if (delta === 0) {
            return;
        }
        if (cameraProperty === null || coordinate === null) {
            return;
        }

        let action = null;
        switch (cameraProperty) {
            case _CameraProperty.MoveRelative:
                action = this._moveRelative;
                break;
            case _CameraProperty.RotateRelative:
                action = this._rotateRelative;
                break;
            case _CameraProperty.MoveScene:
                action = this._moveScene;
                break;
            case _CameraProperty.MoveOverScene:
                action = this._moveOverScene;
                break;
        }

        switch (coordinate) {
            case BABYLON.Coordinate.X:
                action.x += delta;
                break;
            case BABYLON.Coordinate.Y:
                action.y += delta;
                break;
            case BABYLON.Coordinate.Z:
                action.z += delta;
                break;
        }
    }

    /**
     * Test whether the specified modifier keys are currently pressed.
     * @returns Boolean: True if all keys match or are not configured.
     */
    private _modifiersMatch(modifiers: number): boolean {
        return(
            ((Boolean(modifiers & _Modifiers.ShiftDown) ==
                Boolean(modifiers & _Modifiers.ShiftUp) ) ||
                Boolean(modifiers & _Modifiers.ShiftDown) == this._shiftKey)
            &&
            ((Boolean(modifiers & _Modifiers.CtrlDown) ==
                Boolean(modifiers & _Modifiers.CtrlUp) ) ||
                Boolean(modifiers & _Modifiers.CtrlDown) == this._ctrlKey)
            &&
            ((Boolean(modifiers & _Modifiers.AltDown) ==
                Boolean(modifiers & _Modifiers.AltUp) ) ||
                Boolean(modifiers & _Modifiers.AltDown) == this._altKey)
            &&
            ((Boolean(modifiers & _Modifiers.MetaDown) ==
                Boolean(modifiers & _Modifiers.MetaUp) ) ||
                Boolean(modifiers & _Modifiers.MetaDown) == this._metaKey)
            &&
            ((Boolean(modifiers & _Modifiers.MouseButton1Down) ==
                Boolean(modifiers & _Modifiers.MouseButton1Up)) ||
                (Boolean(modifiers & _Modifiers.MouseButton1Down) ==
                Boolean(this._buttonsPressed & _MouseButtons.Button1)))
            &&
            ((Boolean(modifiers & _Modifiers.MouseButton2Down) ==
                Boolean(modifiers & _Modifiers.MouseButton2Up)) ||
                (Boolean(modifiers & _Modifiers.MouseButton2Down) ==
                Boolean(this._buttonsPressed & _MouseButtons.Button2)))
            &&
            ((Boolean(modifiers & _Modifiers.MouseButton3Down) ==
                Boolean(modifiers & _Modifiers.MouseButton3Up)) ||
                (Boolean(modifiers & _Modifiers.MouseButton3Down) ==
                Boolean(this._buttonsPressed & _MouseButtons.Button3)))
        );
    }

    private _pointerToCamera = new Map();

    private _moveRelative = BABYLON.Vector3.Zero();
    private _rotateRelative = BABYLON.Vector3.Zero();
    private _moveScene = BABYLON.Vector3.Zero();
    private _moveOverScene = BABYLON.Vector3.Zero();
    private _deltaX = 0;
    private _deltaY = 0;
    private _deltaPinch = 0;

    private _mapPointerToCamera(pointerInputType: _PointerInputTypes,
                                pointerModifiers: number,
                                cameraProperty: _CameraProperty,
                                cameraAxis: BABYLON.Coordinate): void {
        let pointerInput;
        if (this._pointerToCamera.has(pointerInputType)) {
            pointerInput = this._pointerToCamera.get(pointerInputType);
        } else {
            pointerInput = new Map();
            this._pointerToCamera.set(pointerInputType, pointerInput);
        }

        pointerInput.set(pointerModifiers, [cameraProperty, cameraAxis]);
    }
}

(<any>BABYLON.CameraInputTypes)["FreeCameraPointersInput"] = FreeCameraPointersInput;
