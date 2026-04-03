export const PROJECTS_DATA: Record<string, any> = {
    "114A10089": {
        title: "某市正北路橋樑工程標段維護",
        client: "交通部公路局",
        contractAmount: "25,698",
        days: "841",
        progress: 43,
        planned: 60,
        payment: 35,
        status: "施工中",
        color: "green"
    },
    "114A10092": {
        title: "濱海大道橋樑 A - 基樁及承台工程",
        client: "縣政府工務局",
        contractAmount: "125,400",
        days: "520",
        progress: 85,
        planned: 80,
        payment: 70,
        status: "施工中",
        color: "green"
    },
    "113B20155": {
        title: "北港商業大樓 - 地下室開挖工程",
        client: "私人業主",
        contractAmount: "88,200",
        days: "310",
        progress: 45,
        planned: 60,
        payment: 30,
        status: "落後中",
        color: "orange"
    }
};

export const getProject = (id: string) => {
    return PROJECTS_DATA[id] || PROJECTS_DATA["114A10089"];
};
