const React     = require("react");
const ReactDOM  = require("react-dom");
const ace       = require("brace");
                   ace.config.set("basePath", "/");
const Range      = ace.acequire('ace/range').Range;
const AceEditor  = require("react-ace");

const { nTimes, stopTheBubbly } = require("../util");

const PlotContainer = require("./code-cell-plot-container");
const SyntaxPopup = require("./code-cell-syntax-helper");

let focused = false

function uid() {
  return Math.round(Math.random()*2000000000)
}

const CodeCellOutput = React.createClass({
  parseOutput(output, key) {
    let {data} = output;

    if (data["text/html"]) {
      return this.html(data["text/html"], key);
    }

    if (data["image/png"]) {
      return this.png(data["image/png"], key);
    }

    if (data["text/plain"]) {
      return this.text(data["text/plain"], key);
    }

    return [];
  },

  html(data, key) {
    //fixme - cuts off table
    let styles = { overflowX: "hidden", };
    let htmlString = data.join("");
    return (
      <div style={styles} className={this.props.underConstruction}
          key={key}
          dangerouslySetInnerHTML={{__html: htmlString }}></div>
    );
  },

  png(data, key) {
   return (<img src={"data:image/png;base64," + data} key={key} />);
  },

  text(data, key) {
    let className = this.props.className + " " + this.props.underConstruction;
    let getPlotContainers = this.props.getPlotContainers;
    return (
      <div className={className} key={key} >
        {data.join("")}
        {getPlotContainers()}
      </div>
    );
  },

  render() {
    return (
      <div>
        {this.props.outputs.map(this.parseOutput)}
      </div>
    );
  },
});

const CodeCell = React.createClass({
  getInitialState() {
    return {
      editor: null,
      showPopUp: false,
      local: {},
    };
  },

  componentDidMount() {
    const editor = document.querySelector("#editor" + this.props.index);
    if (editor) editor.addEventListener("click", stopTheBubbly);
    window.addEventListener("resize", this.windowResize)
  },

  componentWillUnmount() {
    const editor = document.querySelector("#editor" + this.props.index);
    if (editor) editor.removeEventListener("click", stopTheBubbly);
    this.state.editor.destroy();
    window.removeEventListener("resize", this.windowResize)
  },

  windowResize(event) {
    this.updateEditorSize(this.editor);
  },

  underConstruction() {
    console.log("error", this.props.error)
    return this.props.error && focused // this.props.error.under_construction;
  },


/*
  appendLoadingClass(className) {
    return className + " pyresult-under-construction";
  },
*/

  hasError() {
    return !!this.props.error;
  },

  errorMessage() {
    if (!this.hasError()) return "";

    let errorObject = this.props.error,
        message = errorObject.message,
        name = errorObject.name,
        className = "pyresult pyresult-error";

    if (this.underConstruction()) {
//      className = this.appendLoadingClass("pyresult");
      return (<div onClick={stopTheBubbly} className={""}></div>)
    }

    return (<div onClick={stopTheBubbly} className={className}>{name}: {message}</div>);
  },

  getPlotContainers() {
    const { plots } = this.props;
    if (!plots || !plots.length) return (<div/>);
    return plots.map( (p, i) => {
      const cellIndex = this.props.index;
      const key = cellIndex + "-" + i;
      return (
        <PlotContainer
          cellIndex={cellIndex}
          cellPlotIndex={i}
          key={key}
          plotMessage={p}/>
      );
    });
  },

  outputs() {
    let outputs = this.props.result || [];

    if (outputs.length === 0) {
      if (this.props.code) {
        return (<div className="pyresult pyresult-loading pyresult-loading-with-message"></div>);
      }
      return (<div className="pyresult"></div>);
    }

    let className = "pyresult";

//    if (this.underConstruction())
//      className = this.appendLoadingClass(className);
    let underConstruction = this.underConstruction() ? "pyresult-under-construction" : ""

    return (
        <CodeCellOutput
          outputs={outputs}
          className={className}
          underConstruction={underConstruction}
          getPlotContainers={this.getPlotContainers} />
      );
  },

  code() {
    return (
      <div className="code">{this.props.code}</div>
    );
  },

  handleEditorChange(code) {
    const codeList = this.props.store.getState().doc.codeList;
    const id = this.props.index;
    const codeDelta = {};
    codeDelta[id] = code;
    const data = { codeList, codeDelta };
    const editID = uid()
    this.props.store.dispatch({ type: "CODE_DELTA", data, editID })
  },

  sizeEditor(editor) {
    const container = editor.container;
    const containerParent = container.parentElement;
    const { height, width } = containerParent.getBoundingClientRect();
    const leftPadding = +getComputedStyle(containerParent, null).getPropertyValue('padding-left').replace("px","");
    const rightPadding = +getComputedStyle(containerParent, null).getPropertyValue('padding-right').replace("px","");
    const topPadding = +getComputedStyle(containerParent, null).getPropertyValue('padding-top').replace("px","");
    // const bottomPadding = +getComputedStyle(containerParent, null).getPropertyValue('padding-bottom').replace("px","");

    container.style.height = "auto";
    container.style.minHeight = (height - topPadding) + "px";
    container.style.width = (width - leftPadding - rightPadding) + "px";
    containerParent.firstChild.style.display = "none"; // hide the code block
    container.style.display = "block";
  },

  updateEditorSize(editor) {
    this.sizeEditor(editor);
    let session = editor.getSession();
    let numRows = editor.getSession().getScreenLength();
    let lineHeight = editor.renderer.lineHeight || 16;
    let minHeight = (numRows * lineHeight) + "px";

    editor.container.style.minHeight = minHeight;
    editor.resize();
  },

  createAceEditor() {
    let change, onBeforeLoad, onLoad;

    onLoad = (editor) => {

      let lastTimeout;
      let lastWord;

      this.editor = editor;

      this.updateEditorSize(editor);

      editor.getSession().setUseWorker(false);

      hideEditorCursor(editor);

      const showDef = () => {
        if (!this.props.locals) {
          // Probably means we haven't gotten response from worker yet
          return;
        }
        let selection = editor.getSelection();
        let wordRange = selection.getWordRange();
        let word = editor.session.getTextRange(wordRange);

        if (word === lastWord) return;

        lastWord = word;

        let match = editor.session.getLine(wordRange.start.row).match('(\\w+)[.]' + word)
        if (match) {
          let local = this.props.locals[match[1]];
          let attribute = undefined
          if (local && local.reflection && local.reflection.attrs) {
            attribute = local.reflection.attrs[word]
            if (attribute) {
              attribute.name = word
            }
            this.setState({ local, attribute });
          } else {
            this.setState({ local: undefined , attribute: undefined });
          }
        } else {
          let local = this.props.locals[word];
          let attribute = undefined
          this.setState({ local, attribute });
        }
      };

      const hidePanel = () => {
        this.setState({ showPopUp: false });
      }

      editor.on("focus", (event) => {
        focused = true
        clearTimeout(lastTimeout);
        this.setState({ showPopUp: true });
        showEditorCursor(editor);
      });

      editor.on("mousedown", (event) => {
        this.handleCodeCellFocus(event, true);
        global._ACEEDITOR = editor;
      })

      editor.on("blur", () => {
        focused = false
        clearTimeout(lastTimeout);
        lastTimeout = setTimeout(hidePanel, 100);
        hideEditorCursor(editor);
      });

      editor.selection.on("changeCursor", (event, _) => {
        clearTimeout(lastTimeout);
        lastTimeout = setTimeout(() => showDef(), 60)
      });

      editor.on("change", () => this.updateEditorSize(editor))

      this.setState({ editor });
    };

    change = (text) => {
      this.handleEditorChange(text)
    };

    onBeforeLoad = () => {};

    return (
      <AceEditor className="editor"
        name={"editor" + this.props.index}
        mode={"python"}
        key={this.props.index}
        value={this.props.code}
        theme="github" onChange={change}
        showGutter={false}
        wrapEnabled={true}
        editorProps={{$blockScrolling: true,}}
        onBeforeLoad={onBeforeLoad} onLoad = {onLoad} />
    );
  },

  handleCodeCellFocus(event, returnFocusToEditor=false) {
    const placeholder = this.props.focusEditorOnPlaceholder(this.props.index);
    if (returnFocusToEditor && !this.state.editor.isFocused()) {
      this.state.editor.focus();
    }
  },

  render() {
    const id = "overlay" + this.props.index;
    let styles = {}; 
    if (this.props.peerHighlights) {
      styles["boxShadow"] = "0 0 0 2px " + this.props.peerHighlights.color;
    };
    return (
      <div>
        <div style={styles} ref="codeCellContainer" className="notebook" id={id} onClick={(e) => this.handleCodeCellFocus(e) }>
          <div className="cell-wrap">
            <div className="cell" data-cell-index={this.props.index}>
              <SyntaxPopup getColor={this.props.getColor} show={this.state.showPopUp} local={this.state.local} store={this.props.store} attribute={this.state.attribute} />
              <div className="switch">
                <div className="codewrap">
                  <div>
                    {this.code()}
                  </div>
                  {this.createAceEditor()}
                </div>
              </div>
              {this.errorMessage()}
              {this.outputs()}
            </div>
          </div>
        </div>

      </div>
    );
  }
});

module.exports = CodeCell;

function showEditorCursor(editor) {
  let { container } = editor;
  [].forEach.call(container.querySelectorAll(".ace_cursor"), _showCursorHelper);
}

function _showCursorHelper(cursor) {
  cursor.style.display = "inherit";
}

function hideEditorCursor(editor) {
  let { container } = editor;
  [].forEach.call(container.querySelectorAll(".ace_cursor"), _hideCursorHelper);
}

function _hideCursorHelper(cursor) {
  cursor.style.display = "none";
}
