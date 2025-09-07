<template>
  <div class="layout-detail-tab bs-layout-vertical h-full">
    <div class="bs-layout-horizontal fixed-header flex-align-center">
      <div class="flex-grow-1">
        <span :data-id="topBarId.left"/>
      </div>
      <div class="bs-layout-horizontal gap-4">
        <BSButton v-if="brandCode" :caption="{key: 'ecp.changeHist'}" button-color="gray" class="ml-4"
                  data-id="changeHistBtn"
                  @click="changeHist"/>
        <BSButton v-if="brandCode"
                  :caption="{ key: 'ecp.logicallyDeleted' }"
                  :disabled="brandStatus?.deleted"
                  button-color="red"
                  class="ml-4"
                  data-id="delete"
                  @click="remove"/>
        <span :data-id="topBarId.right"/>
      </div>
    </div>

    <BSTabSheet v-model:tab-id="currentTabId"
                :tabs="tabs"
                class="detail-top colored-bg">

      <template #basic>
        <BrandDetailBasic :brand-code="brandCode" :brand-status="brandStatus" tab-id="basic"
                          @status-changed="refreshBrandStatus"/>
      </template>

      <template #content>
        <PageBuilderContentTab :area-codes="authorizedAreaCodes"
                               :available-widgets="availableWidgets"
                               :locales="dataLocaleService.getGlobalLocales()"
                               :resource-id="brandCode"
                               :top-bar-left-selector="`[data-id=${topBarId.left}]`"
                               :top-bar-right-selector="`[data-id=${topBarId.right}]`"
                               content-scope="Area"
                               resource-type="Brand"
                               tab-id="content"/>
      </template>

      <template #seo>
        <BrandSeo :brand-code="brandCode" :brand-status="brandStatus" tab-id="seo"/>
      </template>

      <template #prod>
        <BrandDetailProduct :brand-code="brandCode" tab-id="prod"/>
      </template>

    </BSTabSheet>
  </div>
</template>

<script lang="ts" setup>
import {tabs} from "@/main/page/basic-info/brand/BrandDetail.gen.ts"
import {BSButton, BSTabSheet, parsePathParam, showNotification, useDefaultFrame, useModal} from "@g1cloud/bluesea"
import BrandDetailBasic from "@/main/page/basic-info/brand/BrandDetailBasic.vue"
import {computed, defineAsyncComponent, onMounted, reactive, ref} from "vue"
import {useRoute} from "vue-router"
import BrandDetailProduct from "@/main/page/basic-info/brand/BrandDetailProduct.vue"
import {BrandBasicDto, brandService, BrandStatus} from "@/main/page/basic-info/brand/service/brandService.ts"
import BrandSeo from "@/main/page/basic-info/brand/BrandSeo.vue"
import {dataLocaleService, userDataService} from "@/main/env/userDataService.ts";
import {createTopBarId} from '@/common/uiUtil.ts'
import PageBuilderContentTab from '@/main/page/cms/common/PageBuilderContentTab.vue'
import {BrandContext, providePageBuilderContext} from "@/page-builder/widget/typeAdapter.ts";
import {COMMON_WIDGETS} from "@/page-builder/widgetList.ts";
import {getResponseErrorCode} from "@/common/errorService.ts";
import {withTransactionInfo} from "@/common/transactionInfo.ts"

const modal = useModal()
const frame = useDefaultFrame()

const currentTabId = ref<string>()
const brandStatus = ref<BrandStatus>()
const route = useRoute()
const pathParam = parsePathParam(route)
const brandCode = computed(() => pathParam[1])

const refreshBrandStatus = async () => {
  if (brandCode.value) {
    brandStatus.value = await brandService.getBrandStatus(brandCode.value)

    // PageBuilder Widget 에서 사용하는 BrandContext 정보 갱신
    const brand = await brandService.getBrandBasic(brandCode.value)
    refreshBrandContext(brand)
  }
}

const remove = async (event: Event) => {
  modal.openYesNo(undefined,
      {key: 'ecp.confirmDeleteLogical'},
      async () => {
        await withTransactionInfo(event, async () => {
          try {
            await brandService.deleteBrand(brandCode.value)
            await frame.closeActivePage() // 등록 후에는 탭을 닫는다.
            await frame.openPagePath(`BrandDetail/${brandCode.value}`)
          } catch (e) {
            if (getResponseErrorCode(e) === 'ERR_SALES_BRAND_001') {
              showNotification({key: 'ecp.relativeProdErrorMsg'})
            } else throw e
          }
        })
      })
}

const authorizedAreaCodes = ref<string[]>()

onMounted(async () => {
  await refreshBrandStatus()
  authorizedAreaCodes.value = (await userDataService.authorizedAreaItems()).map(area => area.code)
})

const changeHist = async (): Promise<void> => {
  modal.openModal({
    component: defineAsyncComponent(() => import('../../common/ChangeHistoryModal.vue')),
    bind: {
      resourceType: 'Brand',
      resourceId: brandCode.value
    }
  })
}

// PageBuilder 내의 Brand 관련 widget 에서 사용하는 데이터.
// Brand 관련 widget 에서 현재 Brand 에 대한 정보를 사용할 때, 이 값을 사용한다.
const brandContext = reactive<BrandContext>({})
const refreshBrandContext = (brand: BrandBasicDto) => {
  brandContext.brandCode = brand.brandCode
  brandContext.brandName = brand.brandName
  brandContext.logoImageRectangle = brand.logoImageRectangle
  brandContext.logoImageSquare = brand.logoImageSquare
  brandContext.productImage = brand.productImage
  brandContext.brandDesc = brand.brandDesc
}
providePageBuilderContext({currentBrand: brandContext})

const topBarId = createTopBarId(route)

const availableWidgets = [
  ...COMMON_WIDGETS,

  'BrandDeliveryMonthWidget',
  'BrandLogoBannerWidget',
  'BrandBannerWidget',
  'BrandBanner3ImageWidget',
  'BrandProductBannerWidget',
  'BrandTopInfoWidget',
  'BrandTopSeriesWidget'
]
</script>
