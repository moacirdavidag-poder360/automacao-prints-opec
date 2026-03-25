export interface ICampaignsSheetType {
  Cliente: string;
  "Nome da campanha": string;
  "Número PI/PO": string;
  "Data de início veiculação": string;
  "Data de término veiculação": string;
  "Formato (s)": string;
  "Link de Preview": string;
}

export interface ICampaignsObjectType {
    customer: string;
    name: string;
    poNumber: string;
    startDate: string;
    endDate: string;
    format: {
        width: string;
        height: string;
        type: string;
    };
    previewLink: string;
  }
  