const React     = require("react");
const ReactDOM  = require("react-dom");
const { VelocityTransitionGroup } = require('velocity-react');

const getTypeMetaData = () => {};

const Text = () => ({

  docLink({ name, type, docs }) {
    if (name && type) {
      return <a className="notebook-syntax-helper-docs" href={docs} target="_blank">{ type } docs &rarr;</a>;
    }
    return "";
  },

  spacer() {
    return (
      <span className="notebook-syntax-helper-spacer">
        &nbsp; &bull; &nbsp;
      </span>
    );
  },

  value(v) {
    const spacer = this.spacer();

    if (typeof v === "string" || typeof v === "number") {
      return (
        <span>
          { spacer }
          <span className="notebook-syntax-helper-purple">{ v }</span>
        </span>
      );
    }

    if (typeof v === "object") { // array, that is
      return (
        v.map((d, i)=> {
          const className = "notebook-syntax-helper-" + ( i === 0 ? "purple" : "orange");
          return (
            <span>
              { spacer }
              <span className={className}>{ d }</span>
            </span>
          );
        })
      );
    }

    return "";
  },

  render() {
    const { local, attribute } = this.props;
    const reflection = local && local.reflection;

    if (!reflection) {
      return <div style={this.props.style} />
    }

    let { name } = local;
    let { type, value, docs } = reflection;

    if (attribute) {
      name  = name + "." + attribute.name
      type  = attribute.type
      value = attribute.value
      docs  = attribute.docs
    }

    if (type === null) inspect = "";
    if (type === null) name = "";
    return (
      <div style={this.props.style} className="notebook-syntax-helper">
        <span className="notebook-syntax-helper-code">{ name }</span>
        <span className="notebook-syntax-helper-blue">{ type }</span>
        { this.value(value) }
        {this.docLink({ name, type, docs })}
      </div>
    );
  }
})

const SyntaxPopup = () => ({

  styles() {
    let color = this.props.getColor && this.props.getColor();
    color = color || "rgba(167,167,167,1)";
    const style = {
      background: "rgba(225,225,225,.98)",
      border: `solid 2px ${color}`,
      borderRadius: 5,
      boxSizing: "border-box",
      fontSize: "95%",
      height: 50,
      left: "3%",
      padding: ".4em 1em .5em",
      position: "absolute",
      visibility: "hidden",
      width: "91%",
      zIndex: 0,
    };
    return style;
  },

  render() {
    const enter = {
      animation: {
        maxHeight: 1000,
        translateY: -35,
      },
      duration: 300,
      visibility: "visible",
    };
    const leave = {
      animation: {
        maxHeight: 0,
        translateY: 0,
      },
      duration: 300,
      visibility: "hidden",
    };

    return (
      <VelocityTransitionGroup enter={enter} leave={leave}>
        { this.props.show ? <Text style={this.styles()} local={this.props.local} attribute={this.props.attribute}/> : undefined }
      </VelocityTransitionGroup>
    );
  }
});

module.exports = SyntaxPopup;
