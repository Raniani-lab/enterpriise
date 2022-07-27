/** @odoo-module **/

const { useRef, useEffect } = owl;

export const DocumentsRendererMixin = (component) => class extends component {
    setup() {
        super.setup();
        this.root = useRef("root");
        useEffect(
            (el) => {
                if (!el) {
                    return;
                }
                const overHandler = this.onDragOver.bind(this);
                const leaveHandler = this.onDragLeave.bind(this);
                const scrollHandler = () => {
                    this.documentDropZone.move(el.scrollTop);
                };
                el.addEventListener("dragover", overHandler);
                el.addEventListener("dragleave", leaveHandler);
                el.addEventListener("scroll", scrollHandler);
                return () => {
                    el.removeEventListener("dragover", overHandler);
                    el.removeEventListener("dragleave", leaveHandler);
                    el.removeEventListener("scroll", scrollHandler);
                };
            },
            () => [this.root.el]
        );
    }

    getDocumentsInspectorProps() {
        return {
            selection: this.props.list.selection,
            count: this.props.list.model.useSampleModel ? 0 : this.props.list.count,
            fileSize: this.props.list.fileSize,
            archInfo: this.props.archInfo,
        };
    }

    setDropZone(documentDropZone) {
        this.documentDropZone = documentDropZone;
    }

    onDragOver(ev) {
        if (!this.env.searchModel.getSelectedFolderId() || !ev.dataTransfer.types.includes("Files")) {
            return;
        }
        ev.stopPropagation();
        ev.preventDefault();
        if (this.root && this.root.el) {
            this.root.el.classList.add("o_documents_drop_over");
        }
        this.documentDropZone.toggle(true);
    }

    onDragLeave(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        if (this.root && this.root.el) {
            this.root.el.classList.remove("o_documents_drop_over");
        }
        this.documentDropZone.toggle(false);
    }

    async onDrop(ev) {
        if (!this.env.searchModel.getSelectedFolderId() || !ev.dataTransfer.types.includes("Files")) {
            return;
        }
        if (this.root && this.root.el) {
            this.root.el.classList.remove("o_documents_drop_over");
        }
        this.documentDropZone.toggle(false);
        await this.env.bus.trigger("documents-upload-files", {
            files: ev.dataTransfer.files,
            folderId: this.env.searchModel.getSelectedFolderId(),
            recordId: false,
            params: {
                tagIds: this.env.searchModel.getSelectedTagIds(),
            },
        });
    }
};
