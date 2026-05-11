export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chairs: {
        Row: {
          brand: string
          condition: string | null
          created_at: string
          created_by: string
          date_acquired: string
          date_listed: string | null
          date_sold: string | null
          defects: string | null
          helper_cost: number
          id: string
          list_price: number | null
          model: string | null
          notes: string | null
          proof_purchase_url: string | null
          purchase_price: number
          receipt_urls: string[] | null
          refurb_cost: number
          sku: string
          sold_price: number | null
          source: Database["public"]["Enums"]["chair_source"]
          status: Database["public"]["Enums"]["chair_status"]
          storage_unit: string | null
          team_id: string
          transport_cost: number
          trip_end: string | null
          trip_estimated_km: number | null
          trip_km: number | null
          trip_round_trip: boolean | null
          trip_start: string | null
          updated_at: string
          work_done: string | null
        }
        Insert: {
          brand: string
          condition?: string | null
          created_at?: string
          created_by: string
          date_acquired?: string
          date_listed?: string | null
          date_sold?: string | null
          defects?: string | null
          helper_cost?: number
          id?: string
          list_price?: number | null
          model?: string | null
          notes?: string | null
          proof_purchase_url?: string | null
          purchase_price?: number
          receipt_urls?: string[] | null
          refurb_cost?: number
          sku: string
          sold_price?: number | null
          source?: Database["public"]["Enums"]["chair_source"]
          status?: Database["public"]["Enums"]["chair_status"]
          storage_unit?: string | null
          team_id: string
          transport_cost?: number
          trip_end?: string | null
          trip_estimated_km?: number | null
          trip_km?: number | null
          trip_round_trip?: boolean | null
          trip_start?: string | null
          updated_at?: string
          work_done?: string | null
        }
        Update: {
          brand?: string
          condition?: string | null
          created_at?: string
          created_by?: string
          date_acquired?: string
          date_listed?: string | null
          date_sold?: string | null
          defects?: string | null
          helper_cost?: number
          id?: string
          list_price?: number | null
          model?: string | null
          notes?: string | null
          proof_purchase_url?: string | null
          purchase_price?: number
          receipt_urls?: string[] | null
          refurb_cost?: number
          sku?: string
          sold_price?: number | null
          source?: Database["public"]["Enums"]["chair_source"]
          status?: Database["public"]["Enums"]["chair_status"]
          storage_unit?: string | null
          team_id?: string
          transport_cost?: number
          trip_end?: string | null
          trip_estimated_km?: number | null
          trip_km?: number | null
          trip_round_trip?: boolean | null
          trip_start?: string | null
          updated_at?: string
          work_done?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chairs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string
          expense_date: string
          id: string
          notes: string | null
          receipt_url: string | null
          team_id: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by: string
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          team_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          team_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      member_locations: {
        Row: {
          lat: number | null
          lng: number | null
          sharing: boolean
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          lat?: number | null
          lng?: number | null
          sharing?: boolean
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          lat?: number | null
          lng?: number | null
          sharing?: boolean
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_locations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      odometer_readings: {
        Row: {
          created_at: string
          created_by: string
          end_km: number | null
          id: string
          start_km: number | null
          team_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by: string
          end_km?: number | null
          id?: string
          start_km?: number | null
          team_id: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          end_km?: number | null
          id?: string
          start_km?: number | null
          team_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          anthropic_key: string | null
          created_at: string
          current_team_id: string | null
          email: string | null
          full_name: string | null
          id: string
          notification_email: string | null
          updated_at: string
        }
        Insert: {
          anthropic_key?: string | null
          created_at?: string
          current_team_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          notification_email?: string | null
          updated_at?: string
        }
        Update: {
          anthropic_key?: string | null
          created_at?: string
          current_team_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          notification_email?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_team_id_fkey"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_units: {
        Row: {
          created_at: string
          id: string
          name: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_units_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          brand_prefix: string
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        Insert: {
          brand_prefix?: string
          created_at?: string
          id?: string
          invite_code: string
          name: string
          owner_id: string
        }
        Update: {
          brand_prefix?: string
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          chair_id: string | null
          created_at: string
          created_by: string
          end_location: string
          estimated_km: number | null
          id: string
          km: number
          purpose: string | null
          round_trip: boolean
          start_location: string
          team_id: string
          trip_date: string
        }
        Insert: {
          chair_id?: string | null
          created_at?: string
          created_by: string
          end_location: string
          estimated_km?: number | null
          id?: string
          km: number
          purpose?: string | null
          round_trip?: boolean
          start_location: string
          team_id: string
          trip_date?: string
        }
        Update: {
          chair_id?: string | null
          created_at?: string
          created_by?: string
          end_location?: string
          estimated_km?: number | null
          id?: string
          km?: number
          purpose?: string | null
          round_trip?: boolean
          start_location?: string
          team_id?: string
          trip_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_chair_id_fkey"
            columns: ["chair_id"]
            isOneToOne: false
            referencedRelation: "chairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["vehicle_expense_category"]
          created_at: string
          created_by: string
          expense_date: string
          id: string
          notes: string | null
          odometer_km: number | null
          receipt_url: string | null
          team_id: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["vehicle_expense_category"]
          created_at?: string
          created_by: string
          expense_date?: string
          id?: string
          notes?: string | null
          odometer_km?: number | null
          receipt_url?: string | null
          team_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["vehicle_expense_category"]
          created_at?: string
          created_by?: string
          expense_date?: string
          id?: string
          notes?: string | null
          odometer_km?: number | null
          receipt_url?: string | null
          team_id?: string
          vendor?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_team: { Args: { _name: string }; Returns: string }
      current_user_team: { Args: never; Returns: string }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      join_team_by_code: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      chair_source:
        | "fb_marketplace"
        | "kijiji"
        | "supplier"
        | "estate_sale"
        | "other"
      chair_status: "in_stock" | "listed" | "sold"
      expense_category:
        | "vehicle_fuel"
        | "helper_wages"
        | "refurb_supplies"
        | "cleaning_supplies"
        | "tools_equipment"
        | "storage_rent"
        | "phone_internet"
        | "insurance"
        | "bank_fees"
        | "other"
      team_role: "owner" | "member"
      vehicle_expense_category:
        | "gas"
        | "insurance"
        | "oil_change"
        | "tires"
        | "registration"
        | "repairs"
        | "parking"
        | "car_wash"
        | "lease"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      chair_source: [
        "fb_marketplace",
        "kijiji",
        "supplier",
        "estate_sale",
        "other",
      ],
      chair_status: ["in_stock", "listed", "sold"],
      expense_category: [
        "vehicle_fuel",
        "helper_wages",
        "refurb_supplies",
        "cleaning_supplies",
        "tools_equipment",
        "storage_rent",
        "phone_internet",
        "insurance",
        "bank_fees",
        "other",
      ],
      team_role: ["owner", "member"],
      vehicle_expense_category: [
        "gas",
        "insurance",
        "oil_change",
        "tires",
        "registration",
        "repairs",
        "parking",
        "car_wash",
        "lease",
        "other",
      ],
    },
  },
} as const
