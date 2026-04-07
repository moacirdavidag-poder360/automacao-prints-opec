export interface ICampaignCreativeSize {
  width: number;
  height: number;
  isAspectRatio: boolean;
}

export interface ICampaignCreative {
  creative_id: { $numberLong: string };
  creative_name: string;
  creative_type: string | null;
  preview_url: string;
  size: ICampaignCreativeSize;
  association_status: string;
  association_sizes: any[];
  impressions_delivered: number;
  clicks_delivered: number;
  viewable_impressions_delivered: number;
  viewability_rate: number;
}

export interface ICampaignItemLinha {
  item_linha_id: { $numberLong: string };
  criativos: ICampaignCreative[];
}

export interface ICampaignDatabase {
  _id: { $oid: string };
  order_id: { $numberLong: string };
  codigo_agencia: { $numberLong: string };
  codigo_moeda: string;

  data_inicio_obj: Date;
  data_inicio_str: string;

  data_fim_obj: Date;
  data_fim_str: string;

  itens_linha: ICampaignItemLinha[];

  meta_campanha: string;
  nome_agencia: string;
  order_nome: string;
  poNumber: string;

  programatica: boolean;
  status: string;

  total_cliques: number;
  total_cliques_entregues: number;
  total_cpm: number;
  total_ctr: number;
  total_impressoes: number;
  total_impressoes_entregues: number;
  total_viewability: number;
  total_viewability_rate: number;

  ultima_atualizacao: Date;
  ultima_modificacao_obj: Date;
  ultima_modificacao_str: string;
}
