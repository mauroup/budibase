import { roles } from "@budibase/backend-core"
import { BASE_LAYOUT_PROP_IDS } from "./layouts"
import { Screen, Table, Query, ViewV2, Component } from "@budibase/types"

export function createHomeScreen(
  config: {
    roleId: string
    route: string
  } = {
    roleId: roles.BUILTIN_ROLE_IDS.BASIC,
    route: "/",
  }
): Screen {
  return {
    layoutId: BASE_LAYOUT_PROP_IDS.PRIVATE,
    props: {
      _id: "d834fea2-1b3e-4320-ab34-f9009f5ecc59",
      _component: "@budibase/standard-components/container",
      _styles: {
        normal: {},
        hover: {},
        active: {},
        selected: {},
      },
      _transition: "fade",
      _children: [
        {
          _id: "ef60083f-4a02-4df3-80f3-a0d3d16847e7",
          _component: "@budibase/standard-components/heading",
          _styles: {
            hover: {},
            active: {},
            selected: {},
          },
          text: "Welcome to your Budibase App 👋",
          size: "M",
          align: "left",
          _instanceName: "Heading",
          _children: [],
        },
      ],
      _instanceName: "Home",
      direction: "column",
      hAlign: "stretch",
      vAlign: "top",
      size: "grow",
      gap: "M",
    },
    routing: {
      route: config.route,
      roleId: config.roleId,
    },
    name: "home-screen",
  }
}

function heading(text: string): Component {
  return {
    _id: "c1bff24cd821e41d18c894ac77a80ef99",
    _component: "@budibase/standard-components/heading",
    _styles: {
      normal: {},
      hover: {},
      active: {},
      selected: {},
    },
    _instanceName: "Table heading",
    _children: [],
    text,
  }
}

export function createTableScreen(
  datasourceName: string,
  table: Table
): Screen {
  return {
    props: {
      _id: "cad0a0904cacd4678a2ac094e293db1a5",
      _component: "@budibase/standard-components/container",
      _styles: {
        normal: {},
        hover: {},
        active: {},
        selected: {},
      },
      _children: [
        heading("table"),
        {
          _id: "ca6304be2079147bb9933092c4f8ce6fa",
          _component: "@budibase/standard-components/gridblock",
          _styles: {
            normal: {},
            hover: {},
            active: {},
            selected: {},
          },
          _instanceName: "table - Table",
          _children: [],
          table: {
            label: table.name,
            tableId: table._id!,
            type: "table",
            datasourceName,
          },
        },
      ],
      _instanceName: "table - List",
      layout: "grid",
      direction: "column",
      hAlign: "stretch",
      vAlign: "top",
      size: "grow",
      gap: "M",
    },
    routing: {
      route: "/table",
      roleId: "ADMIN",
      homeScreen: false,
    },
    name: "screen-id",
  }
}

export function createViewScreen(datasourceName: string, view: ViewV2): Screen {
  return {
    props: {
      _id: "cc359092bbd6c4e10b57827155edb7872",
      _component: "@budibase/standard-components/container",
      _styles: {
        normal: {},
        hover: {},
        active: {},
        selected: {},
      },
      _children: [
        heading("view"),
        {
          _id: "ccb4a9e3734794864b5c65b012a0bdc5a",
          _component: "@budibase/standard-components/gridblock",
          _styles: {
            normal: {},
            hover: {},
            active: {},
            selected: {},
          },
          _instanceName: "view - Table",
          _children: [],
          table: {
            ...view,
            name: view.name,
            tableId: view.tableId,
            id: view.id,
            label: view.name,
            type: "viewV2",
          },
        },
      ],
      _instanceName: "view - List",
      layout: "grid",
      direction: "column",
      hAlign: "stretch",
      vAlign: "top",
      size: "grow",
      gap: "M",
    },
    routing: {
      route: "/view",
      roleId: "ADMIN",
      homeScreen: false,
    },
    name: "view-id",
  }
}

export function createQueryScreen(datasourceId: string, query: Query): Screen {
  return {
    props: {
      _id: "cc59b217aed264939a6c5249eee39cb25",
      _component: "@budibase/standard-components/container",
      _styles: {
        normal: {},
        hover: {},
        active: {},
        selected: {},
      },
      _children: [
        {
          _id: "c33a4a6e3cb5343158a08625c06b5cd7c",
          _component: "@budibase/standard-components/gridblock",
          _styles: {
            normal: {},
            hover: {},
            active: {},
          },
          _instanceName: "New Table",
          table: {
            ...query,
            label: query.name,
            _id: query._id!,
            name: query.name,
            datasourceId: datasourceId,
            type: "query",
          },
          initialSortOrder: "Ascending",
          allowAddRows: true,
          allowEditRows: true,
          allowDeleteRows: true,
          stripeRows: false,
          quiet: false,
          columns: null,
        },
      ],
      _instanceName: "Blank screen",
      layout: "grid",
      direction: "column",
      hAlign: "stretch",
      vAlign: "top",
      size: "grow",
      gap: "M",
    },
    routing: {
      route: "/query",
      roleId: "BASIC",
      homeScreen: false,
    },
    name: "screen-id",
  }
}

export function createSampleDataTableScreen(): Screen {
  return {
    showNavigation: true,
    width: "Large",
    routing: { route: "/inventory", roleId: "BASIC", homeScreen: false },
    name: "sample-data-inventory-screen",
    props: {
      _id: "c38f2b9f250fb4c33965ce47e12c02a80",
      _component: "@budibase/standard-components/container",
      _styles: { normal: {}, hover: {}, active: {}, selected: {} },
      _children: [
        {
          _id: "cf600445f0b0048c79c0c81606b30d542",
          _component: "@budibase/standard-components/gridblock",
          _styles: {
            normal: {
              "--grid-desktop-col-start": 1,
              "--grid-desktop-col-end": 13,
              "--grid-desktop-row-start": 3,
              "--grid-desktop-row-end": 21,
            },
            hover: {},
            active: {},
            selected: {},
          },
          _instanceName: "Inventory - Table",
          _children: [],
          table: {
            label: "Inventory",
            tableId: "ta_bb_inventory",
            type: "table",
            datasourceName: "Sample Data",
          },
          columns: [
            { label: "Item Tags", field: "Item Tags", active: true },
            { label: "Purchase Date", field: "Purchase Date", active: true },
            {
              label: "Purchase Price",
              field: "Purchase Price",
              active: true,
              format:
                // eslint-disable-next-line no-template-curly-in-string
                "${{ [cf600445f0b0048c79c0c81606b30d542].[Purchase Price] }}",
            },
            { label: "Notes", field: "Notes", active: true },
            {
              label: "Status",
              field: "Status",
              active: true,
              conditions: [
                {
                  target: "row",
                  metadataKey: "backgroundColor",
                  operator: "contains",
                  valueType: "array",
                  metadataValue: "var(--spectrum-global-color-red-100)",
                  noValue: false,
                  referenceValue: "Repair",
                },
              ],
            },
            { label: "SKU", field: "SKU", active: true },
            { label: "Item ID", field: "Item ID", active: true },
            { label: "Created At", field: "Created At", active: false },
            { label: "Updated At", field: "Updated At", active: false },
            { label: "Item Name", field: "Item Name", active: true },
          ],
          initialSortColumn: "Item ID",
        },
        {
          _id: "c09edf7de69be44ce8f0215c3f62e43a5",
          _component: "@budibase/standard-components/textv2",
          _styles: { normal: {}, hover: {}, active: {} },
          _instanceName: "New Text",
          align: "left",
          text: "## Inventory",
        },
      ],
      _instanceName: "Inventory - List",
      layout: "grid",
      direction: "column",
      hAlign: "stretch",
      vAlign: "top",
      size: "grow",
      gap: "M",
    },
  }
}
