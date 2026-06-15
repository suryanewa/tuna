/**
 * ImageSection -- image/video media controls and background image settings.
 *
 * Contains two sub-sections:
 * - "Image" / "Video": object-fit, object-position, loading, alt, autoplay, etc.
 * - "Background Image": background-size, background-position, background-repeat
 *
 * Extracted from PropertyPanel.tsx lines 1814-1984.
 */

import type { BaseSectionProps } from "./section-props";
import { Section, Row, Field } from "../section";
import { TextInput } from "../text-input";
import { SelectInput } from "../select-input";
import { ComboInput } from "../combo-input";
import { SegmentedControl } from "../segmented-control";

export interface ImageSectionProps extends BaseSectionProps {
  /** Is this an img/picture/canvas element? */
  isImage: boolean;
  /** Is this a video element? */
  isVideo: boolean;
  /** Does the element have a non-gradient background-image? */
  hasBackgroundImage: boolean;
}

export function ImageSection({
  element,
  s,
  onPropertyChange,
  onAttributeChange,
  variableProps,
  changeProps,
  isImage,
  isVideo,
  hasBackgroundImage,
}: ImageSectionProps) {
  const isMedia = isImage || isVideo;

  return (
    <>
      {/* Image / Media */}
      {isMedia && (
        <Section label={isVideo ? "Video" : "Image"}>
          <Row>
            <Field label="Fit">
              <SelectInput
                prop="objectFit"
                value={s.objectFit || "fill"}
                options={["fill", "contain", "cover", "none", "scale-down"]}
                onChange={onPropertyChange}
                {...variableProps("objectFit")}
                {...changeProps("objectFit")}
              />
            </Field>
            <Field label="Position">
              <ComboInput
                prop="objectPosition"
                value={s.objectPosition || "50% 50%"}
                options={[
                  { value: "center", label: "Center" },
                  { value: "top", label: "Top" },
                  { value: "bottom", label: "Bottom" },
                  { value: "left", label: "Left" },
                  { value: "right", label: "Right" },
                  { value: "top left", label: "Top Left" },
                  { value: "top right", label: "Top Right" },
                  { value: "bottom left", label: "Bottom Left" },
                  { value: "bottom right", label: "Bottom Right" },
                ]}
                onChange={onPropertyChange}
                {...variableProps("objectPosition")}
                {...changeProps("objectPosition")}
              />
            </Field>
          </Row>
          {isImage && element.element && (
            <Row>
              <Field label="Loading">
                <SegmentedControl
                  options={[{ value: "lazy", label: "Lazy" }, { value: "eager", label: "Eager" }]}
                  value={((element.element as HTMLImageElement).loading === "lazy") ? "lazy" : "eager"}
                  onChange={(v) => {
                    const oldVal = (element.element as HTMLImageElement).loading || "eager";
                    (element.element as HTMLImageElement).loading = v as "lazy" | "eager";
                    onAttributeChange?.("loading", oldVal, v);
                  }}
                />
              </Field>
            </Row>
          )}
          {isImage && element.element && (
            <Row label="Alt">
              <div className="tuna-row">
                <TextInput
                  prop="alt"
                  value={(element.element as HTMLImageElement).alt || ""}
                  onChange={(prop, value) => {
                    if (element.element) {
                      const oldVal = (element.element as HTMLImageElement).alt || "";
                      (element.element as HTMLImageElement).alt = value;
                      onAttributeChange?.(prop, oldVal, value);
                    }
                  }}
                />
              </div>
            </Row>
          )}
          {isVideo && element.element && (
            <>
              <Row>
                <Field label="Autoplay">
                  <SegmentedControl
                    options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]}
                    value={(element.element as HTMLVideoElement).autoplay ? "true" : "false"}
                    onChange={(v) => {
                      const oldVal = (element.element as HTMLVideoElement).autoplay ? "true" : "false";
                      (element.element as HTMLVideoElement).autoplay = v === "true";
                      onAttributeChange?.("autoplay", oldVal, v === "true" ? "true" : "false");
                    }}
                  />
                </Field>
                <Field label="Loop">
                  <SegmentedControl
                    options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]}
                    value={(element.element as HTMLVideoElement).loop ? "true" : "false"}
                    onChange={(v) => {
                      const oldVal = (element.element as HTMLVideoElement).loop ? "true" : "false";
                      (element.element as HTMLVideoElement).loop = v === "true";
                      onAttributeChange?.("loop", oldVal, v === "true" ? "true" : "false");
                    }}
                  />
                </Field>
              </Row>
              <Row>
                <Field label="Muted">
                  <SegmentedControl
                    options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]}
                    value={(element.element as HTMLVideoElement).muted ? "true" : "false"}
                    onChange={(v) => {
                      const oldVal = (element.element as HTMLVideoElement).muted ? "true" : "false";
                      (element.element as HTMLVideoElement).muted = v === "true";
                      onAttributeChange?.("muted", oldVal, v === "true" ? "true" : "false");
                    }}
                  />
                </Field>
                <Field label="Controls">
                  <SegmentedControl
                    options={[{ value: "true", label: "Show" }, { value: "false", label: "Hide" }]}
                    value={(element.element as HTMLVideoElement).controls ? "true" : "false"}
                    onChange={(v) => {
                      const oldVal = (element.element as HTMLVideoElement).controls ? "true" : "false";
                      (element.element as HTMLVideoElement).controls = v === "true";
                      onAttributeChange?.("controls", oldVal, v === "true" ? "true" : "false");
                    }}
                  />
                </Field>
              </Row>
            </>
          )}
        </Section>
      )}

      {/* Background Image */}
      {hasBackgroundImage && (
        <Section label="Background Image">
          <Row label="Size">
            <div className="tuna-row">
              <ComboInput
                label=""
                prop="backgroundSize"
                value={s.backgroundSize || "auto"}
                options={[
                  { value: "cover", label: "Cover" },
                  { value: "contain", label: "Contain" },
                  { value: "auto", label: "Auto" },
                  { value: "100% 100%", label: "Stretch" },
                ]}
                onChange={onPropertyChange}
                {...variableProps("backgroundSize")}
                {...changeProps("backgroundSize")}
              />
            </div>
          </Row>
          <Row label="Position">
            <div className="tuna-row">
              <SelectInput
                prop="backgroundPosition"
                value={s.backgroundPosition || "center center"}
                options={["center", "top", "bottom", "left", "right", "top left", "top right", "bottom left", "bottom right"]}
                onChange={onPropertyChange}
                {...variableProps("backgroundPosition")}
                {...changeProps("backgroundPosition")}
              />
            </div>
          </Row>
          <Row label="Repeat">
            <div className="tuna-row">
              <SelectInput
                prop="backgroundRepeat"
                value={s.backgroundRepeat || "repeat"}
                options={["no-repeat", "repeat", "repeat-x", "repeat-y", "space", "round"]}
                onChange={onPropertyChange}
                {...variableProps("backgroundRepeat")}
                {...changeProps("backgroundRepeat")}
              />
            </div>
          </Row>
        </Section>
      )}
    </>
  );
}
