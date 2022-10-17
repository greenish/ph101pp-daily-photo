import React from "react";
import UploadImage from "./UploadImage";
import MetadataForm from "./MetadataForm";
import MetadataPreview from "./MetadataPreview";
import ExifData from "./ExifData";
import UploadAndPublish from "./UploadAndPublish";
import NextAuthHeader from "./NextAuthHeader";
import { useSession } from "next-auth/react";
import { useRecoilValue } from "recoil";
import tokenIdAtom from "./_atoms/tokenIdAtom";
import getFutureMetadata from "../utils/getFutureMetadata";
import ExistingToken from "./ExistingToken";
import manifestAtom from "./_atoms/manifestAtom";

export default function NewToken() {
  const { data: session, status } = useSession()
  const tokenId = useRecoilValue(tokenIdAtom);
  const manifest = useRecoilValue(manifestAtom);

  if(!tokenId) {
    return null;
  }
  
  const futureTokenData = getFutureMetadata(tokenId);

  if(!session || !manifest) {
    return <ExistingToken tokenMetadata = {futureTokenData}  />
  }

  return (
    <>  
      <NextAuthHeader />
      <UploadImage />
      <ExifData />
      <MetadataForm />
      <MetadataPreview />
      <UploadAndPublish />
    </>
  )
}
