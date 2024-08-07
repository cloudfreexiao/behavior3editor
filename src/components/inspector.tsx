import { EditNode, EditTree, useWorkspace } from "@/contexts/workspace-context";
import { NodeArg, NodeModel, TreeGraphData } from "@/misc/b3type";
import { checkOneof } from "@/misc/b3util";
import { Hotkey, isMacos } from "@/misc/keys";
import { mergeClassNames } from "@/misc/util";
import { EditOutlined } from "@ant-design/icons";
import {
  AutoComplete,
  Button,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
} from "antd";
import TextArea from "antd/es/input/TextArea";
import { DefaultOptionType } from "antd/es/select";
import { FC, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";

interface OptionType extends DefaultOptionType {
  value: string;
}

const TreeInspector: FC = () => {
  const workspace = {
    editing: useWorkspace((state) => state.editing),
    editingTree: useWorkspace((state) => state.editingTree)!,
  };
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // set form values
  useEffect(() => {
    const data = workspace.editingTree.data;
    form.resetFields();
    form.setFieldValue("name", data.name);
    form.setFieldValue("desc", data.desc);
    form.setFieldValue("export", data.export !== false);
  }, [workspace.editingTree]);

  const finish = (values: any) => {
    workspace.editing?.dispatch("updateTree", {
      data: {
        name: values.name,
        desc: values.desc || undefined,
        export: values.export,
      },
    } as EditTree);
  };

  return (
    <>
      <div style={{ padding: "12px 24px" }}>
        <span style={{ fontSize: "18px", fontWeight: "600" }}>{t("tree.overview")}</span>
      </div>
      <div
        className={mergeClassNames("b3-inspector-content", isMacos ? "" : "b3-overflow")}
        style={{ overflow: "auto", height: "100%" }}
      >
        <Form form={form} labelCol={{ span: 8 }} onFinish={finish}>
          <Form.Item name="name" label={t("tree.name")}>
            <Input disabled={true} />
          </Form.Item>
          <Form.Item name="desc" label={t("tree.desc")}>
            <TextArea autoSize onBlur={form.submit} />
          </Form.Item>
          <Form.Item name="export" label={t("tree.export")} valuePropName="checked">
            <Switch onChange={() => form.submit()} />
          </Form.Item>
        </Form>
      </div>
    </>
  );
};

const NodeInspector: FC = () => {
  const workspace = {
    editing: useWorkspace((state) => state.editing),
    editingNode: useWorkspace((state) => state.editingNode)!,
    getNodeDef: useWorkspace((state) => state.getNodeDef),
    nodeDefs: useWorkspace((state) => state.nodeDefs),
    onEditingNode: useWorkspace((state) => state.onEditingNode),
    allFiles: useWorkspace((state) => state.allFiles),
    fileTree: useWorkspace((state) => state.fileTree),
    relative: useWorkspace((state) => state.relative),
  };
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // set form values
  useEffect(() => {
    const data = workspace.editingNode.data;
    const def = workspace.getNodeDef(workspace.editingNode.data.name);
    form.resetFields();
    form.setFieldValue("id", data.id);
    form.setFieldValue("name", data.name);
    form.setFieldValue("type", def.type);
    form.setFieldValue("desc", data.desc || def.desc);
    form.setFieldValue("debug", data.debug);
    form.setFieldValue("disabled", data.disabled);
    form.setFieldValue("path", data.path);
    if (def.children === undefined || def.children === -1) {
      form.setFieldValue("children", t("node.children.unlimited"));
    } else {
      form.setFieldValue("children", def.children);
    }
    def.args?.forEach((v) => {
      if (v.type === "json" || v.type === "json?") {
        const value = data.args?.[v.name];
        form.setFieldValue(
          `args.${v.name}`,
          value === null ? "null" : JSON.stringify(value ?? v.default, null, 2)
        );
      } else {
        form.setFieldValue(`args.${v.name}`, data.args?.[v.name] ?? v.default);
      }
    });
    def.input?.forEach((_, i) => {
      form.setFieldValue(`input.${i}`, data.input?.[i]);
    });
    def.output?.forEach((_, i) => {
      form.setFieldValue(`output.${i}`, data.output?.[i]);
    });
    form.validateFields();
  }, [workspace.editingNode]);

  // auto complete for node
  const nodeOptions = useMemo(() => {
    const options: OptionType[] = [];
    workspace.nodeDefs.forEach((e) => {
      options.push({ label: `${e.name}(${e.desc})`, value: e.name });
    });
    return options;
  }, [workspace.nodeDefs]);

  // auto complete for input and output
  const inoutVarOptions = useMemo(() => {
    const options: OptionType[] = [];
    const collect = (node?: TreeGraphData) => {
      if (node) {
        node.input?.forEach((v, i) => {
          const desc = node.def.input?.[i] ?? "<unknown>";
          if (v && !options.find((option) => option.value === v)) {
            options.push({ label: `${v}(${desc})`, value: v });
          }
        });
        node.output?.forEach((v, i) => {
          const desc = node.def.output?.[i] ?? "<unknown>";
          if (v && !options.find((option) => option.value === v)) {
            options.push({ label: `${v}(${desc})`, value: v });
          }
        });
        node.children?.forEach((child) => collect(child));
      }
    };
    collect(workspace.editing?.data);
    return options;
  }, [workspace.editing]);

  // auto complete for subtree
  const subtreeOptions = useMemo(() => {
    const options: OptionType[] = [];
    workspace.allFiles.forEach((file) => {
      const value = workspace.relative(file.path);
      const desc = ""; //fileNode.desc ? `(${fileNode.desc})` : "";
      options.push({
        label: `${value}${desc}`,
        value: value,
      });
    });
    options.sort((a, b) => a.value.localeCompare(b.value));
    return options;
  }, [workspace.allFiles, workspace.fileTree]);

  const editingNode = workspace.editingNode;
  const def = workspace.getNodeDef(editingNode.data.name);
  const disabled = !editingNode.editable;

  // update value
  const finish = (values: any) => {
    const data = {} as NodeModel;
    data.id = editingNode.data.id;
    data.name = values.name;
    data.debug = values.debug || undefined;
    data.disabled = values.disabled || undefined;
    data.desc = values.desc && values.desc !== def.desc ? values.desc : undefined;
    data.path = values.path || undefined;

    if (def.args?.length) {
      def.args?.forEach((arg) => {
        const v = values[`args.${arg.name}`];
        if (v !== null && v !== undefined && v !== "") {
          data.args ||= {};
          if (arg.type === "json" || arg.type === "json?") {
            data.args[arg.name] = v === "null" ? null : JSON.parse(v);
          } else {
            data.args[arg.name] = v;
          }
        }
      });
    } else {
      data.args = {};
    }

    if (def.input?.length) {
      def.input?.forEach((_, i) => {
        const v = values[`input.${i}`];
        data.input ||= [];
        data.input.push(v ?? "");
      });
    } else {
      data.input = [];
    }

    if (def.output?.length) {
      def.output?.forEach((_, i) => {
        const v = values[`output.${i}`];
        data.output ||= [];
        data.output.push(v ?? "");
      });
    } else {
      data.output = [];
    }

    workspace.editing?.dispatch("updateNode", {
      data: data,
    } as EditNode);
  };

  // change node def
  const changeNodeDef = (newname: string) => {
    if (editingNode.data.name !== newname) {
      workspace.onEditingNode({
        data: {
          id: editingNode.data.id,
          name: workspace.nodeDefs.get(newname)?.name ?? newname,
          desc: editingNode.data.desc,
          debug: editingNode.data.debug,
          disabled: editingNode.data.disabled,
        },
        editable: editingNode.editable,
      });
      finish(form.getFieldsValue());
    } else {
      form.submit();
    }
  };

  const changeSubtree = () => {
    if (form.getFieldValue("path") !== editingNode.data.path) {
      finish(form.getFieldsValue());
    } else {
      form.submit();
    }
  };

  return (
    <>
      <div style={{ padding: "12px 24px" }}>
        <span style={{ fontSize: "18px", fontWeight: "600" }}>{def.desc}</span>
      </div>
      <div
        className={mergeClassNames("b3-inspector-content", isMacos ? "" : "b3-overflow")}
        style={{ overflow: "auto", height: "100%" }}
      >
        <Form
          form={form}
          wrapperCol={{ span: "auto" }}
          labelCol={{ span: "auto" }}
          onFinish={finish}
        >
          <Form.Item name="id" label={t("node.id")}>
            <Input disabled={true} />
          </Form.Item>
          <Form.Item name="type" label={t("node.type")}>
            <Input disabled={true} />
          </Form.Item>
          <Form.Item name="children" label={t("node.children")}>
            <Input
              style={{ borderColor: editingNode.limit_error ? "red" : undefined }}
              disabled={true}
            />
          </Form.Item>
          <Form.Item label={t("node.name")} name="name">
            <AutoComplete
              disabled={disabled}
              options={nodeOptions}
              onBlur={() => changeNodeDef(form.getFieldValue("name"))}
              onSelect={changeNodeDef}
              onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
              filterOption={(inputValue: string, option?: OptionType) => {
                const label = option!.label as string;
                return label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1;
              }}
            />
          </Form.Item>
          <Form.Item name="desc" label={t("node.desc")}>
            <TextArea autoSize disabled={disabled} onBlur={form.submit} />
          </Form.Item>
          <Form.Item label={t("node.debug")} name="debug" valuePropName="checked">
            <Switch disabled={disabled && !editingNode.data.path} onChange={form.submit} />
          </Form.Item>
          <Form.Item label={t("node.disabled")} name="disabled" valuePropName="checked">
            <Switch disabled={disabled && !editingNode.data.path} onChange={form.submit} />
          </Form.Item>
          <Form.Item label={t("node.subtree")} name="path">
            <AutoComplete
              disabled={disabled && !editingNode.data.path}
              options={subtreeOptions}
              onBlur={changeSubtree}
              onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
              filterOption={(inputValue: string, option?: OptionType) => {
                const label = option!.label as string;
                return label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1;
              }}
            />
          </Form.Item>
          <Markdown className="b3-markdown">{def.doc}</Markdown>
          {def.input && def.input.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.inputVariable")}</h4>
              </Divider>
              {def.input.map((v, i) => {
                const required = v.indexOf("?") === -1;
                const desc = v.replace("?", "");
                return (
                  <Form.Item
                    label={desc}
                    name={`input.${i}`}
                    key={`input.${i}`}
                    rules={[
                      { required, message: t("node.fileRequired", { field: desc }) },
                      ({ getFieldValue, setFieldValue, isFieldValidating, validateFields }) => ({
                        validator(_, value) {
                          const arg = def.args?.find((a) => a.oneof && v.startsWith(a.oneof));
                          if (arg) {
                            const argName = `args.${arg.name}`;
                            if (!isFieldValidating(argName)) {
                              setFieldValue(`input.${i}`, value);
                              validateFields([argName]);
                            }
                            if (!checkOneof(getFieldValue(argName) ?? "", value)) {
                              return Promise.reject(
                                new Error(
                                  t("node.oneof.error", {
                                    input: v,
                                    arg: arg.name,
                                    desc: arg.desc ?? "",
                                  })
                                )
                              );
                            } else {
                              return Promise.resolve();
                            }
                          }

                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <AutoComplete
                      disabled={disabled}
                      options={inoutVarOptions}
                      onBlur={form.submit}
                      onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
                      filterOption={(inputValue: string, option?: OptionType) => {
                        const label = option!.label as string;
                        return label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1;
                      }}
                    />
                  </Form.Item>
                );
              })}
            </>
          )}
          {def.args && def.args.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.args")}</h4>
              </Divider>
              {def.args.map((v) => {
                const required = v.type.indexOf("?") === -1;
                const type = v.type.replace("?", "") as NodeArg["type"];
                return (
                  <Form.Item
                    name={`args.${v.name}`}
                    label={v.desc}
                    key={`args.${v.name}`}
                    initialValue={type === "boolean" ? v.default ?? false : v.default}
                    valuePropName={type === "boolean" ? "checked" : undefined}
                    rules={[
                      { required, message: t("node.fileRequired", { field: v.desc }) },
                      ({ getFieldValue, setFieldValue, isFieldValidating, validateFields }) => ({
                        validator(_, value) {
                          if (value && (v.type === "json" || v.type === "json?")) {
                            try {
                              if (value !== "null") {
                                JSON.parse(value);
                              }
                            } catch (e) {
                              return Promise.reject(new Error(t("node.invalidValue")));
                            }
                          }
                          if (v.oneof === undefined) {
                            return Promise.resolve();
                          }
                          const idx = def.input?.findIndex((input) => input.startsWith(v.oneof!));
                          if (idx === undefined || idx < 0) {
                            return Promise.reject(
                              new Error(t("node.oneof.inputNotfound", { input: v.oneof }))
                            );
                          }
                          const inputName = `input.${idx}`;
                          if (!isFieldValidating(inputName)) {
                            setFieldValue(`args.${v.name}`, value);
                            validateFields([inputName]);
                          }
                          if (!checkOneof(getFieldValue(inputName) ?? "", value)) {
                            return Promise.reject(
                              new Error(
                                t("node.oneof.error", {
                                  input: def.input![idx],
                                  arg: v.name,
                                  desc: v.desc ?? "",
                                })
                              )
                            );
                          } else {
                            return Promise.resolve();
                          }
                        },
                      }),
                    ]}
                  >
                    {type === "string" && (
                      <TextArea autoSize disabled={disabled} onBlur={form.submit} />
                    )}
                    {type === "json" && (
                      <TextArea autoSize disabled={disabled} onBlur={form.submit} />
                    )}
                    {type === "int" && (
                      <InputNumber disabled={disabled} onBlur={form.submit} precision={0} />
                    )}
                    {type === "float" && <InputNumber disabled={disabled} onBlur={form.submit} />}
                    {type === "boolean" && <Switch disabled={disabled} onChange={form.submit} />}
                    {type === "code" && <Input disabled={disabled} onBlur={form.submit} />}
                    {type === "enum" && (
                      <Select disabled={disabled} onBlur={form.submit} onChange={form.submit}>
                        {v.options?.map((value, index) => {
                          return (
                            <Select.Option key={index} value={value.value}>
                              {value.name}
                            </Select.Option>
                          );
                        })}
                      </Select>
                    )}
                  </Form.Item>
                );
              })}
            </>
          )}
          {def.output && def.output.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.outputVariable")}</h4>
              </Divider>
              {def.output.map((v, i) => {
                const required = v.indexOf("?") === -1;
                const desc = v.replace("?", "");
                return (
                  <Form.Item
                    label={desc}
                    name={`output.${i}`}
                    key={`output.${i}`}
                    rules={[{ required, message: t("node.fileRequired", { field: desc }) }]}
                  >
                    <AutoComplete
                      disabled={disabled}
                      options={inoutVarOptions}
                      onBlur={form.submit}
                      onInputKeyDown={(e) => e.code === Hotkey.Escape && e.preventDefault()}
                      filterOption={(inputValue: string, option?: OptionType) => {
                        const label = option!.label as string;
                        return label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1;
                      }}
                    />
                  </Form.Item>
                );
              })}
            </>
          )}
        </Form>
        {disabled && (
          <Flex style={{ paddingTop: "30px" }}>
            <Button
              type="primary"
              style={{ width: "100%" }}
              icon={<EditOutlined />}
              onClick={() => workspace.editing?.dispatch("editSubtree")}
            >
              {t("editSubtree")}
            </Button>
          </Flex>
        )}
      </div>
    </>
  );
};

const NodeDefInspector: FC = () => {
  const workspace = {
    editingNodeDef: useWorkspace((state) => state.editingNodeDef)!,
  };
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const def = workspace.editingNodeDef.data;

  // set form values
  useEffect(() => {
    form.resetFields();
    form.setFieldValue("name", def.name);
    form.setFieldValue("type", def.type);
    form.setFieldValue("desc", def.desc);
    form.setFieldValue("doc", def.doc);
    if (def.children === undefined || def.children === -1) {
      form.setFieldValue("children", t("node.children.unlimited"));
    } else {
      form.setFieldValue("children", def.children);
    }
    def.input?.forEach((v, i) => {
      form.setFieldValue(`input.${i}.name`, v.replaceAll("?", ""));
    });
    def.output?.forEach((v, i) => {
      form.setFieldValue(`output.${i}.name`, v.replaceAll("?", ""));
    });
    def.args?.forEach((v, i) => {
      form.setFieldValue(`args.${i}.type`, v.type.replaceAll("?", ""));
    });
  }, [workspace.editingNodeDef]);
  return (
    <>
      <div style={{ padding: "12px 24px" }}>
        <span style={{ fontSize: "18px", fontWeight: "600" }}>{t("nodeDefinition")}</span>
      </div>
      <div
        className={mergeClassNames("b3-inspector-content", isMacos ? "" : "b3-overflow")}
        style={{ overflow: "auto", height: "100%" }}
      >
        <Form
          form={form}
          wrapperCol={{ span: "auto" }}
          labelCol={{ span: "auto" }}
          // onFinish={finish}
        >
          <Form.Item name="name" label={t("node.name")}>
            <Input disabled={true} />
          </Form.Item>
          <Form.Item name="type" label={t("node.type")}>
            <Input disabled={true} />
          </Form.Item>
          <Form.Item name="children" label={t("node.children")}>
            <Input disabled={true} />
          </Form.Item>
          <Form.Item name="desc" label={t("node.desc")}>
            <TextArea autoSize disabled={true} />
          </Form.Item>
          <Markdown className="b3-markdown">{def.doc}</Markdown>
          {def.input && def.input.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.inputVariable")}</h4>
              </Divider>
              {def.input.map((v, i) => {
                const required = v.indexOf("?") === -1;
                return (
                  <Form.Item
                    label={`[${i}]`}
                    name={`input.${i}.name`}
                    key={`input.${i}.name`}
                    required={required}
                  >
                    <Input disabled={true} />
                  </Form.Item>
                );
              })}
            </>
          )}
          {def.args && def.args.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.args")}</h4>
              </Divider>
              {def.args.map((v, i) => {
                const required = v.type.indexOf("?") === -1;
                return (
                  <Form.Item
                    name={`args.${i}.type`}
                    label={v.desc}
                    key={`args.${i}.type`}
                    rules={[{ required }]}
                  >
                    <Select disabled={true}>
                      {["float", "int", "string", "code", "enum", "boolean"].map((value) => {
                        return (
                          <Select.Option key={value} value={value}>
                            {value}
                          </Select.Option>
                        );
                      })}
                    </Select>
                  </Form.Item>
                );
              })}
            </>
          )}
          {def.output && def.output.length > 0 && (
            <>
              <Divider orientation="left">
                <h4>{t("node.outputVariable")}</h4>
              </Divider>
              {def.output.map((v, i) => {
                const required = v.indexOf("?") === -1;
                return (
                  <Form.Item
                    label={`[${i}]`}
                    name={`output.${i}.name`}
                    key={`output.${i}.name`}
                    required={required}
                  >
                    <Input disabled={true} />
                  </Form.Item>
                );
              })}
            </>
          )}
        </Form>
      </div>
    </>
  );
};

export const Inspector: FC = () => {
  const workspace = {
    editingNode: useWorkspace((state) => state.editingNode),
    editingTree: useWorkspace((state) => state.editingTree),
    editingNodeDef: useWorkspace((state) => state.editingNodeDef),
  };
  let isEditingNode = false;
  let isEditingTree = false;
  let isEditingNodeDef = false;
  if (workspace.editingNodeDef) {
    isEditingNodeDef = true;
  } else if (workspace.editingTree) {
    isEditingTree = true;
  } else if (workspace.editingNode) {
    isEditingNode = true;
  }
  return (
    <Flex
      vertical
      className="b3-inspector"
      style={{ height: "100%", width: "340px", borderLeft: `1px solid var(--b3-color-border)` }}
    >
      {isEditingNodeDef && <NodeDefInspector />}
      {isEditingTree && <TreeInspector />}
      {isEditingNode && <NodeInspector />}
    </Flex>
  );
};
