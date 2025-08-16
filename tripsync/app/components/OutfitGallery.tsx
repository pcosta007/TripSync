"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, MoreVertical, Trash2 } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc, increment, arrayUnion, arrayRemove } from "firebase/firestore";

export interface OutfitPost {
  id: string;
  user: {
    name: string;
    avatar: string;
    initials: string;
    uid?: string; // Add user ID to identify owner
  };
  image: string;
  description: string;
  likes: number;
  comments: number;
  timestamp: string;
  likedBy?: string[]; // Track who liked
  eventId?: string; // Need these for Firestore paths
  activityId?: string;
}

export interface OutfitGalleryProps {
  outfits: OutfitPost[];
  eventId: string;
  activityId: string;
  onOutfitDeleted?: (outfitId: string) => void; // Callback to update parent state
  onOutfitLiked?: (outfitId: string, newLikeCount: number) => void; // Callback for likes
}

export default function OutfitGallery({ 
  outfits, 
  eventId, 
  activityId,
  onOutfitDeleted,
  onOutfitLiked 
}: OutfitGalleryProps) {
  const [showOptionsMenu, setShowOptionsMenu] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);
  const currentUserId = auth.currentUser?.uid;

  if (!outfits || outfits.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-muted-foreground">
          No outfits shared yet. Be the first to share your look!
        </p>
      </div>
    );
  }

  const handleDelete = async (outfitId: string) => {
    if (!confirm("Are you sure you want to delete this outfit?")) return;
    
    setDeletingId(outfitId);
    try {
      // Delete from Firestore
      const docPath = `events/${eventId}/activities/${activityId}/outfitPhotos/${outfitId}`;
      await deleteDoc(doc(db, docPath));
      
      // Notify parent component
      onOutfitDeleted?.(outfitId);
      
      // TODO: Also delete the image from Storage if needed
      // const imagePath = `events/${eventId}/activities/${activityId}/outfits/${currentUserId}/${imageFileName}`;
      // await deleteObject(ref(storage, imagePath));
      
    } catch (error) {
      console.error("Error deleting outfit:", error);
      alert("Failed to delete outfit. Please try again.");
    } finally {
      setDeletingId(null);
      setShowOptionsMenu(null);
    }
  };

  const handleLike = async (outfit: OutfitPost) => {
    if (!currentUserId) {
      alert("Please sign in to like outfits");
      return;
    }

    setLikingId(outfit.id);
    try {
      const docPath = `events/${eventId}/activities/${activityId}/outfitPhotos/${outfit.id}`;
      const docRef = doc(db, docPath);
      
      const isLiked = outfit.likedBy?.includes(currentUserId);
      
      if (isLiked) {
        // Unlike
        await updateDoc(docRef, {
          likesCount: increment(-1),
          likedBy: arrayRemove(currentUserId)
        });
        onOutfitLiked?.(outfit.id, outfit.likes - 1);
      } else {
        // Like
        await updateDoc(docRef, {
          likesCount: increment(1),
          likedBy: arrayUnion(currentUserId)
        });
        onOutfitLiked?.(outfit.id, outfit.likes + 1);
      }
    } catch (error) {
      console.error("Error updating like:", error);
    } finally {
      setLikingId(null);
    }
  };

  const handleComment = (outfitId: string) => {
    // TODO: Implement comment modal or navigation
    console.log("Comment on outfit:", outfitId);
    alert("Comments coming soon!");
  };

  return (
    <div className="outfit-gallery-container" style={{ backgroundColor: '#f1f5f9', minHeight: '100%', width: '100%' }}>
      <div className="w-full py-4" style={{ position: 'relative', padding: '16px 0' }}>
        <div className="px-4 mb-4">
          <h3>Friends&apos; Outfits</h3>
          {outfits.length > 1 && (
            <p className="text-sm text-muted-foreground mt-1">
              {outfits.length} outfits shared
            </p>
          )}
        </div>

        <Carousel 
          className="w-full" 
          opts={{
            align: "center",
            loop: true,
          }}
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {outfits.map((outfit) => {
              const isOwner = outfit.user.uid === currentUserId;
              const isLiked = outfit.likedBy?.includes(currentUserId || '');
              
              return (
                <CarouselItem 
                  key={outfit.id} 
                  className="pl-2 md:pl-4 basis-[85%] sm:basis-[90%]"
                >
                  <div className="carousel-item-wrapper" style={{ 
                    transform: 'scale(0.95)',
                    transition: 'transform 0.2s',
                    opacity: 0.95
                  }}>
                    <Card className="overflow-hidden shadow-lg">
                      <CardContent className="p-0" style={{ padding: 0 }}>
                        {/* Header */}
                        <div className="p-4 pb-3" style={{ padding: '16px 16px 12px 16px', position: 'relative' }}>
                          <div className="flex items-center gap-3 mb-4">
                            <Avatar 
                              className="w-8 h-8 shrink-0" 
                              style={{ 
                                minWidth: '30px', 
                                minHeight: '30px', 
                                width: '30px', 
                                height: '30px', 
                                borderRadius: '50%', 
                                overflow: 'hidden', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center'
                              }}
                            >
                              {outfit.user.avatar ? (
                                <AvatarImage
                                  src={outfit.user.avatar}
                                  alt={outfit.user.name}
                                />
                              ) : null}
                              <AvatarFallback 
                                className="text-sm" 
                                style={{
                                  backgroundColor: '#e2e8f0',
                                  color: '#64748b',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '100%',
                                  height: '100%'
                                }}
                              >
                                {outfit.user.initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1" style={{ marginLeft: '8px' }}>
                              <p className="font-medium text-base leading-none">{outfit.user.name}</p>
                              <p className="text-sm text-muted-foreground leading-none mt-1">
                                {outfit.timestamp}
                              </p>
                            </div>
                            
                            {/* Options menu - only for owner */}
                            {isOwner && (
                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => setShowOptionsMenu(showOptionsMenu === outfit.id ? null : outfit.id)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '4px',
                                    cursor: 'pointer',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <MoreVertical 
                                    className="h-5 w-5" 
                                    style={{ color: '#64748b' }}
                                  />
                                </button>
                                
                                {/* Dropdown menu */}
                                {showOptionsMenu === outfit.id && (
                                  <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    marginTop: '4px',
                                    background: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                    zIndex: 50,
                                    minWidth: '150px'
                                  }}>
                                    <button
                                      onClick={() => handleDelete(outfit.id)}
                                      disabled={deletingId === outfit.id}
                                      style={{
                                        width: '100%',
                                        padding: '10px 16px',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: deletingId === outfit.id ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        color: '#ef4444',
                                        fontSize: '14px',
                                        opacity: deletingId === outfit.id ? 0.5 : 1,
                                        transition: 'background 0.2s'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      {deletingId === outfit.id ? 'Deleting...' : 'Delete'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Image */}
                        <div className="aspect-[3/4] overflow-hidden">
                          <img
                            src={outfit.image}
                            alt={`${outfit.user.name}'s outfit`}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Actions + description */}
                        <div className="p-4" style={{ padding: '16px' }}>
                          <div className="flex items-center gap-6 mb-3" style={{ gap: '24px', marginBottom: '12px' }}>
                            <button
                              type="button"
                              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                cursor: likingId === outfit.id ? 'not-allowed' : 'pointer',
                                opacity: likingId === outfit.id ? 0.5 : 1
                              }}
                              onClick={() => handleLike(outfit)}
                              disabled={likingId === outfit.id}
                              aria-label="Like"
                            >
                              <Heart 
                                className="w-5 h-5" 
                                style={{ 
                                  width: '18px', 
                                  height: '18px', 
                                  minWidth: '18px', 
                                  minHeight: '18px',
                                  fill: isLiked ? '#ef4444' : 'none',
                                  color: isLiked ? '#ef4444' : 'currentColor'
                                }} 
                                strokeWidth={1.5} 
                              />
                              <span style={{ 
                                marginLeft: '4px',
                                color: isLiked ? '#ef4444' : 'inherit'
                              }}>
                                {outfit.likes}
                              </span>
                            </button>
                            <button
                              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer'
                              }}
                              onClick={() => handleComment(outfit.id)}
                              aria-label="Comments"
                            >
                              <MessageCircle 
                                className="w-5 h-5" 
                                style={{ 
                                  width: '18px', 
                                  height: '18px', 
                                  minWidth: '18px', 
                                  minHeight: '18px' 
                                }} 
                                strokeWidth={1.5} 
                              />
                              <span style={{ marginLeft: '4px' }}>{outfit.comments}</span>
                            </button>
                          </div>

                          {outfit.description && (
                            <p className="text-muted-foreground leading-relaxed">
                              {outfit.description}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          
          {outfits.length > 1 && (
            <>
              <CarouselPrevious className="left-2" style={{ left: '8px' }} />
              <CarouselNext className="right-2" style={{ right: '8px' }} />
            </>
          )}
        </Carousel>
      </div>

      <style jsx>{`
        .outfit-gallery-container {
          all: initial;
          font-family: inherit;
          color: inherit;
          background-color: #f1f5f9;
        }
        .outfit-gallery-container * {
          box-sizing: border-box;
        }
        .outfit-gallery-container button {
          all: unset;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .outfit-gallery-container .flex {
          display: flex;
        }
        .outfit-gallery-container .gap-2 {
          gap: 8px;
        }
        .outfit-gallery-container .gap-3 {
          gap: 12px;
        }
        .outfit-gallery-container .gap-6 {
          gap: 24px;
        }
        
        .outfit-gallery-container [data-carousel-item="active"] .carousel-item-wrapper {
          transform: scale(1) !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}