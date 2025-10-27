import {store} from '../../index';
import {RectUtil} from '../../utils/RectUtil';
import {updateCustomCursorStyle} from '../../store/general/actionCreators';
import {CustomCursorStyle} from '../../data/enums/CustomCursorStyle';
import {EditorData} from '../../data/EditorData';
import {BaseRenderEngine} from './BaseRenderEngine';
import {RenderEngineSettings} from '../../settings/RenderEngineSettings';
import {IPoint} from '../../interfaces/IPoint';
import {DrawUtil} from '../../utils/DrawUtil';
import {IRect} from '../../interfaces/IRect';
import {ImageData, LabelOBB} from '../../store/labels/types';
import {LabelsSelector} from '../../store/selectors/LabelsSelector';
import {
    updateActiveLabelId,
    updateFirstLabelCreatedFlag,
    updateHighlightedLabelId,
    updateImageDataById
} from '../../store/labels/actionCreators';
import {MouseEventUtil} from '../../utils/MouseEventUtil';
import {EventType} from '../../data/enums/EventType';
import {RenderEngineUtil} from '../../utils/RenderEngineUtil';
import {LabelType} from '../../data/enums/LabelType';
import {EditorActions} from '../actions/EditorActions';
import {GeneralSelector} from '../../store/selectors/GeneralSelector';
import {LabelUtil} from '../../utils/LabelUtil';
import {PointUtil} from '../../utils/PointUtil';
import {LabelStatus} from '../../data/enums/LabelStatus';

export class OBBRenderEngine extends BaseRenderEngine {

    // =================================================================================================================
    // STATE
    // =================================================================================================================

    private activePath: IPoint[] = [];
    private resizeAnchorIndex: number = null;

    public constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.labelType = LabelType.OBB;
    }

    // =================================================================================================================
    // EVENT HANDLERS
    // =================================================================================================================

    public update(data: EditorData): void {
        if (!!data.event) {
            switch (MouseEventUtil.getEventType(data.event)) {
                case EventType.MOUSE_MOVE:
                    this.mouseMoveHandler(data);
                    break;
                case EventType.MOUSE_UP:
                    this.mouseUpHandler(data);
                    break;
                case EventType.MOUSE_DOWN:
                    this.mouseDownHandler(data);
                    break;
                default:
                    break;
            }
        }
    }

    public mouseDownHandler(data: EditorData): void {
        const isMouseOverCanvas: boolean = RenderEngineUtil.isMouseOverCanvas(data);
        if (isMouseOverCanvas) {
            if (this.isCreationInProgress()) {
                this.updateActivelyCreatedLabel(data);
            } else {
                const obbUnderMouse: LabelOBB = this.getOBBUnderMouse(data);
                if (!!obbUnderMouse) {
                    const anchorIndex: number = obbUnderMouse.vertices.reduce(
                        (indexUnderMouse: number, anchor: IPoint, index: number) => {
                        if (indexUnderMouse === null) {
                            const anchorOnCanvas: IPoint = RenderEngineUtil.transferPointFromImageToViewPortContent(anchor, data);
                            if (this.isMouseOverAnchor(data.mousePositionOnViewPortContent, anchorOnCanvas)) {
                                return index;
                            }
                        }
                        return indexUnderMouse;
                    }, null);

                    if (anchorIndex !== null) {
                        this.startExistingLabelResize(data, obbUnderMouse.id, anchorIndex);
                    } else {
                        store.dispatch(updateActiveLabelId(obbUnderMouse.id));
                    }
                } else {
                    this.updateActivelyCreatedLabel(data);
                }
            }
        }
    }

    public mouseUpHandler(data: EditorData): void {
        if (this.isResizeInProgress())
            this.endExistingLabelResize(data);
    }

    public mouseMoveHandler(data: EditorData): void {
        if (!!data.viewPortContentImageRect && !!data.mousePositionOnViewPortContent) {
            const isOverImage: boolean = RenderEngineUtil.isMouseOverImage(data);
            if (isOverImage && !this.isCreationInProgress()) {
                const labelOBB: LabelOBB = this.getOBBUnderMouse(data);
                if (!!labelOBB && !this.isResizeInProgress()) {
                    if (LabelsSelector.getHighlightedLabelId() !== labelOBB.id) {
                        store.dispatch(updateHighlightedLabelId(labelOBB.id))
                    }
                } else {
                    if (LabelsSelector.getHighlightedLabelId() !== null) {
                        store.dispatch(updateHighlightedLabelId(null));
                    }
                }
            }
        }
    }

    // =================================================================================================================
    // RENDERING
    // =================================================================================================================

    public render(data: EditorData) {
        const activeLabelId: string = LabelsSelector.getActiveLabelId();
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        if (imageData) {
            imageData.labelOBBs?.forEach((labelOBB: LabelOBB) => {
                if (labelOBB.isVisible) {
                    if (labelOBB.status === LabelStatus.ACCEPTED && labelOBB.id === activeLabelId) {
                        this.drawActiveOBB(labelOBB, data)
                    } else {
                        this.drawInactiveOBB(labelOBB, data);
                    }
                }
            });
            this.drawCurrentlyCreatedOBB(data);
            this.updateCursorStyle(data);
        }
    }

    private drawCurrentlyCreatedOBB(data: EditorData) {
        if (this.activePath.length > 0) {
            const mousePositionSnapped: IPoint = RectUtil.snapPointToRect(
                data.mousePositionOnViewPortContent, 
                data.viewPortContentImageRect
            );
            
            let pathToDraw: IPoint[] = [...this.activePath];
            
            if (this.activePath.length === 1) {
                // Drawing first edge
                pathToDraw.push(mousePositionSnapped);
            } else if (this.activePath.length === 2) {
                // Complete the rectangle
                const p1 = this.activePath[0];
                const p2 = this.activePath[1];
                
                // Calculate perpendicular vector
                const edge = PointUtil.subtract(p2, p1);
                const perpendicular = { x: -edge.y, y: edge.x };
                
                // Project mouse position onto perpendicular direction
                const toMouse = PointUtil.subtract(mousePositionSnapped, p1);
                const projection = (toMouse.x * perpendicular.x + toMouse.y * perpendicular.y) / 
                                 (perpendicular.x * perpendicular.x + perpendicular.y * perpendicular.y);
                
                const offset = { x: perpendicular.x * projection, y: perpendicular.y * projection };
                const p3 = PointUtil.add(p2, offset);
                const p4 = PointUtil.add(p1, offset);
                
                pathToDraw = [p1, p2, p3, p4];
            }
            
            const lineColor: string = BaseRenderEngine.resolveLabelLineColor(null, true);
            DrawUtil.drawPolygon(this.canvas, pathToDraw, lineColor, RenderEngineSettings.LINE_THICKNESS);
            
            // Draw anchors
            pathToDraw.forEach((point: IPoint) => {
                DrawUtil.drawCircleWithFill(
                    this.canvas,
                    point,
                    RenderEngineSettings.anchorSize.width / 2,
                    BaseRenderEngine.resolveLabelAnchorColor(true)
                );
            });
        }
    }

    private drawInactiveOBB(labelOBB: LabelOBB, data: EditorData) {
        const pathOnCanvas: IPoint[] = RenderEngineUtil.transferPolygonFromImageToViewPortContent(labelOBB.vertices, data);
        const highlightedLabelId: string = LabelsSelector.getHighlightedLabelId();
        const displayAsActive: boolean = labelOBB.status === LabelStatus.ACCEPTED && labelOBB.id === highlightedLabelId;
        const lineColor: string = BaseRenderEngine.resolveLabelLineColor(labelOBB.labelId, displayAsActive);
        const anchorColor: string = BaseRenderEngine.resolveLabelAnchorColor(displayAsActive);
        this.renderOBB(pathOnCanvas, displayAsActive, lineColor, anchorColor);
    }

    private drawActiveOBB(labelOBB: LabelOBB, data: EditorData) {
        let pathOnCanvas: IPoint[] = RenderEngineUtil.transferPolygonFromImageToViewPortContent(labelOBB.vertices, data);
        
        if (this.isResizeInProgress()) {
            const snappedMousePosition: IPoint = RectUtil.snapPointToRect(
                data.mousePositionOnViewPortContent,
                data.viewPortContentImageRect
            );
            pathOnCanvas = this.calculateRectangleCorners(pathOnCanvas, this.resizeAnchorIndex, snappedMousePosition);
        }
        
        const lineColor: string = BaseRenderEngine.resolveLabelLineColor(labelOBB.labelId, true);
        const anchorColor: string = BaseRenderEngine.resolveLabelAnchorColor(true);
        this.renderOBB(pathOnCanvas, true, lineColor, anchorColor);
    }

    private renderOBB(pathOnCanvas: IPoint[], isActive: boolean, lineColor: string, anchorColor: string) {
        DrawUtil.drawPolygonWithFill(this.canvas, pathOnCanvas, DrawUtil.hexToRGB(lineColor, 0.2));
        DrawUtil.drawPolygon(this.canvas, pathOnCanvas, lineColor, RenderEngineSettings.LINE_THICKNESS);
        
        if (isActive) {
            pathOnCanvas.forEach((point: IPoint) => {
                DrawUtil.drawCircleWithFill(this.canvas, point, RenderEngineSettings.anchorSize.width / 2, anchorColor);
            });
        }
    }

    private updateCursorStyle(data: EditorData) {
        if (!!this.canvas && !!data.mousePositionOnViewPortContent && !GeneralSelector.getImageDragModeStatus()) {
            const obbUnderMouse: LabelOBB = this.getOBBUnderMouse(data);
            if ((!!obbUnderMouse && obbUnderMouse.status === LabelStatus.ACCEPTED) || this.isInProgress()) {
                store.dispatch(updateCustomCursorStyle(CustomCursorStyle.MOVE));
                this.canvas.style.cursor = 'none';
                return;
            }
            else if (RenderEngineUtil.isMouseOverCanvas(data)) {
                RenderEngineUtil.wrapDefaultCursorStyleInCancel(data);
                this.canvas.style.cursor = 'none';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }

    // =================================================================================================================
    // HELPERS
    // =================================================================================================================

    public isInProgress(): boolean {
        return this.isCreationInProgress() || this.isResizeInProgress();
    }

    private isCreationInProgress(): boolean {
        return this.activePath.length > 0 && this.activePath.length < 3;
    }

    private isResizeInProgress(): boolean {
        return this.resizeAnchorIndex !== null;
    }

    private updateActivelyCreatedLabel = (data: EditorData) => {
        if (this.isCreationInProgress()) {
            const mousePositionSnapped: IPoint = RectUtil.snapPointToRect(
                data.mousePositionOnViewPortContent,
                data.viewPortContentImageRect
            );
            this.activePath.push(mousePositionSnapped);
            
            if (this.activePath.length === 3) {
                this.addLabelAndFinishCreation(data);
            }
        } else {
            const isMouseOverImage: boolean = RenderEngineUtil.isMouseOverImage(data);
            if (isMouseOverImage) {
                this.startLabelCreation(data);
            }
        }
    };

    private startLabelCreation = (data: EditorData) => {
        const mousePositionSnapped: IPoint = RectUtil.snapPointToRect(
            data.mousePositionOnViewPortContent,
            data.viewPortContentImageRect
        );
        this.activePath.push(mousePositionSnapped);
        store.dispatch(updateActiveLabelId(null));
        EditorActions.setViewPortActionsDisabledStatus(true);
    };

    private addLabelAndFinishCreation = (data: EditorData) => {
        const mousePositionSnapped: IPoint = RectUtil.snapPointToRect(
            data.mousePositionOnViewPortContent,
            data.viewPortContentImageRect
        );
        
        // Complete the rectangle
        const p1 = this.activePath[0];
        const p2 = this.activePath[1];
        
        // Calculate perpendicular vector
        const edge = PointUtil.subtract(p2, p1);
        const perpendicular = { x: -edge.y, y: edge.x };
        
        // Project mouse position onto perpendicular direction
        const toMouse = PointUtil.subtract(mousePositionSnapped, p1);
        const projection = (toMouse.x * perpendicular.x + toMouse.y * perpendicular.y) / 
                         (perpendicular.x * perpendicular.x + perpendicular.y * perpendicular.y);
        
        const offset = { x: perpendicular.x * projection, y: perpendicular.y * projection };
        const p3 = PointUtil.add(p2, offset);
        const p4 = PointUtil.add(p1, offset);
        
        const pathOnImage: IPoint[] = [p1, p2, p3, p4].map((point: IPoint) => {
            return RenderEngineUtil.transferPointFromViewPortContentToImage(point, data);
        });
        
        this.addOBBLabel(pathOnImage);
        this.endLabelCreation();
    };

    private endLabelCreation() {
        this.activePath = [];
        EditorActions.setViewPortActionsDisabledStatus(false);
    }

    private addOBBLabel = (vertices: IPoint[]) => {
        const activeLabelId = LabelsSelector.getActiveLabelNameId();
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        const labelOBB: LabelOBB = LabelUtil.createLabelOBB(activeLabelId, vertices);
        
        if (!imageData.labelOBBs) {
            imageData.labelOBBs = [];
        }
        
        imageData.labelOBBs.push(labelOBB);
        store.dispatch(updateImageDataById(imageData.id, imageData));
        store.dispatch(updateFirstLabelCreatedFlag(true));
        store.dispatch(updateActiveLabelId(labelOBB.id));
    };

    private getOBBUnderMouse(data: EditorData): LabelOBB {
        const labelOBBs: LabelOBB[] = LabelsSelector.getActiveImageData().labelOBBs || [];
        
        for (const labelOBB of labelOBBs) {
            if (labelOBB.isVisible && this.isMouseOverOBB(labelOBB.vertices, data)) {
                return labelOBB;
            }
        }
        return null;
    }

    private isMouseOverOBB(vertices: IPoint[], data: EditorData): boolean {
        const pathOnCanvas: IPoint[] = RenderEngineUtil.transferPolygonFromImageToViewPortContent(vertices, data);
        
        // Check if mouse is over any anchor
        for (let i = 0; i < pathOnCanvas.length; i++) {
            if (this.isMouseOverAnchor(data.mousePositionOnViewPortContent, pathOnCanvas[i])) {
                return true;
            }
        }
        
        // Check if mouse is inside the OBB or near edges
        return this.isPointInsidePolygon(data.mousePositionOnViewPortContent, pathOnCanvas);
    }

    private isPointInsidePolygon(point: IPoint, polygon: IPoint[]): boolean {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    private isMouseOverAnchor(mouse: IPoint, anchor: IPoint): boolean {
        const anchorRect: IRect = RectUtil.getRectWithCenterAndSize(anchor, RenderEngineSettings.anchorHoverSize);
        return RectUtil.isPointInside(anchorRect, mouse);
    }

    private calculateRectangleCorners(originalVertices: IPoint[], draggedIndex: number, newPosition: IPoint): IPoint[] {
        // The opposite corner is the anchor (stays fixed)
        const anchorIndex = (draggedIndex + 2) % 4;
        const anchor = originalVertices[anchorIndex];
        
        // Get the two adjacent corners
        const adj1Index = (anchorIndex + 1) % 4;
        const adj2Index = (anchorIndex + 3) % 4;
        
        // Calculate edge vectors from anchor in the original rectangle
        const edge1 = PointUtil.subtract(originalVertices[adj1Index], anchor);
        const edge2 = PointUtil.subtract(originalVertices[adj2Index], anchor);
        
        // Vector from anchor to new dragged position
        const toNew = PointUtil.subtract(newPosition, anchor);
        
        // Normalize edge directions
        const edge1Length = Math.sqrt(edge1.x * edge1.x + edge1.y * edge1.y);
        const edge2Length = Math.sqrt(edge2.x * edge2.x + edge2.y * edge2.y);
        
        if (edge1Length === 0 || edge2Length === 0) {
            return originalVertices;
        }
        
        const edge1Norm = { x: edge1.x / edge1Length, y: edge1.y / edge1Length };
        const edge2Norm = { x: edge2.x / edge2Length, y: edge2.y / edge2Length };
        
        // Project toNew onto both edge directions
        const proj1 = toNew.x * edge1Norm.x + toNew.y * edge1Norm.y;
        const proj2 = toNew.x * edge2Norm.x + toNew.y * edge2Norm.y;
        
        // Calculate new positions for all corners
        const newVertices = new Array(4);
        newVertices[anchorIndex] = anchor;
        newVertices[adj1Index] = {
            x: anchor.x + edge1Norm.x * proj1,
            y: anchor.y + edge1Norm.y * proj1
        };
        newVertices[adj2Index] = {
            x: anchor.x + edge2Norm.x * proj2,
            y: anchor.y + edge2Norm.y * proj2
        };
        newVertices[draggedIndex] = {
            x: anchor.x + edge1Norm.x * proj1 + edge2Norm.x * proj2,
            y: anchor.y + edge1Norm.y * proj1 + edge2Norm.y * proj2
        };
        
        return newVertices;
    }

    private startExistingLabelResize = (data: EditorData, labelId: string, anchorIndex: number) => {
        store.dispatch(updateActiveLabelId(labelId));
        this.resizeAnchorIndex = anchorIndex;
        EditorActions.setViewPortActionsDisabledStatus(true);
    };

    private endExistingLabelResize = (data: EditorData) => {
        const activeLabelOBB: LabelOBB = LabelsSelector.getActiveImageData().labelOBBs.find(
            (label: LabelOBB) => label.id === LabelsSelector.getActiveLabelId()
        );
        
        if (!!activeLabelOBB) {
            const snappedMousePosition: IPoint = RectUtil.snapPointToRect(
                data.mousePositionOnViewPortContent,
                data.viewPortContentImageRect
            );
            const imageData: ImageData = LabelsSelector.getActiveImageData();
            
            imageData.labelOBBs = imageData.labelOBBs.map((labelOBB: LabelOBB) => {
                if (labelOBB.id === activeLabelOBB.id) {
                    // Calculate new rectangle corners in viewport coordinates
                    const verticesOnCanvas = RenderEngineUtil.transferPolygonFromImageToViewPortContent(labelOBB.vertices, data);
                    const newVerticesOnCanvas = this.calculateRectangleCorners(verticesOnCanvas, this.resizeAnchorIndex, snappedMousePosition);
                    
                    // Transfer back to image coordinates
                    const newVertices = newVerticesOnCanvas.map((point: IPoint) => 
                        RenderEngineUtil.transferPointFromViewPortContentToImage(point, data)
                    );
                    
                    return {
                        ...labelOBB,
                        vertices: newVertices
                    };
                }
                return labelOBB;
            });
            
            store.dispatch(updateImageDataById(imageData.id, imageData));
        }
        
        this.resizeAnchorIndex = null;
        EditorActions.setViewPortActionsDisabledStatus(false);
    };
}
